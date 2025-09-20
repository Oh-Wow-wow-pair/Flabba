from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging
import requests
import uuid
from datetime import datetime
from data_handler import UserDataHandler

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

db_handler = UserDataHandler()

pending_leave_requests = {}

@app.route('/api/llm/callback', methods=['POST'])
def llm_callback():
    """
    給 LLM 服務調用的回調接口
    LLM 分析完對話後，會把提取的使用者資料發送到這裡
    """
    try:
        data = request.get_json()
        
        # 預期的資料格式：
        # {
        #     "user_id": "user001",
        #     "extracted_data": {
        #         "leave_days": 12.5,
        #         "meal_allowance": 1500,
        #         ...
        #     }
        # }
        
        if not data or 'user_id' not in data or 'extracted_data' not in data:
            return jsonify({
                'success': False,
                'error': 'Invalid data format. Required: user_id, extracted_data'
            }), 400
        
        user_id = data['user_id']
        extracted_data = data['extracted_data']
        
        logger.info(f"LLM callback - User: {user_id}, Data: {extracted_data}")
        
        # 儲存資料到資料庫
        updated_count = db_handler.process_backend_data(user_id, extracted_data)
        
        # 獲取更新後的完整資料
        user_data = db_handler.get_user_data(user_id)
        
        response = {
            'success': True,
            'message': f'Data updated successfully',
            'user_id': user_id,
            'updated_count': updated_count,
            'current_data': user_data,
            'timestamp': datetime.now().isoformat()
        }
        
        logger.info(f"LLM callback success - Updated {updated_count} records for {user_id}")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"LLM callback error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/leave/request', methods=['POST'])
def leave_request():
    """
    LLM 發送請假申請到前端的接口
    流程: LLM → 這個API → 前端確認 → 前端回傳OK → 資料庫更新
    """
    try:
        data = request.get_json()
        
        # 預期格式:
        # {
        #     "user_id": "user001", 
        #     "leave_type": "annual_leave",  # 假別
        #     "start_date": "2025-09-25",
        #     "end_date": "2025-09-26", 
        #     "days": 2,
        #     "reason": "personal matters"
        # }
        
        required_fields = ['user_id', 'leave_type', 'start_date', 'end_date', 'days']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {required_fields}'
            }), 400
        
        request_id = str(uuid.uuid4())[:8]
        
        leave_request_data = {
            'request_id': request_id,
            'user_id': data['user_id'],
            'leave_type': data['leave_type'],
            'start_date': data['start_date'],
            'end_date': data['end_date'],
            'days': data['days'],
            'reason': data.get('reason', ''),
            'status': 'pending_frontend',
            'created_at': datetime.now().isoformat()
        }
        
        pending_leave_requests[request_id] = leave_request_data
        
        logger.info(f"Leave request created: {request_id} for user {data['user_id']}")
        
        # 通知前端
        frontend_notified = notify_frontend_leave_request(leave_request_data)
        
        return jsonify({
            'success': True,
            'message': 'Leave request created and sent to frontend',
            'request_id': request_id,
            'frontend_notified': frontend_notified,
            'status': 'pending_frontend',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Leave request error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/leave/confirm', methods=['POST'])
def leave_confirm():
    """
    前端確認請假申請的接口
    前端確認後，更新資料庫並回傳給LLM
    """
    try:
        data = request.get_json()
        
        # 預期格式:
        # {
        #     "request_id": "abc123",
        #     "approved": true,  # 前端確認結果
        #     "message": "請假申請已處理"
        # }
        
        if 'request_id' not in data:
            return jsonify({
                'success': False,
                'error': 'request_id is required'
            }), 400
        
        request_id = data['request_id']
        approved = data.get('approved', False)
        
        # 檢查請假申請是否存在
        if request_id not in pending_leave_requests:
            return jsonify({
                'success': False,
                'error': 'Leave request not found'
            }), 404
        
        leave_request = pending_leave_requests[request_id]
        
        if approved:
            # 前端確認 OK，更新使用者的特休天數
            user_id = leave_request['user_id']
            days_used = leave_request['days']
            
            # 獲取現有特休天數
            current_data = db_handler.get_user_data(user_id, 'leave')
            current_leave_days = current_data.get('value', 0) if current_data else 0
            
            # 扣除請假天數
            new_leave_days = max(0, current_leave_days - days_used)
            
            # 更新資料庫
            updated_count = db_handler.process_backend_data(user_id, {
                'leave_days': new_leave_days
            })
            
            # 更新請假申請狀態
            leave_request['status'] = 'approved'
            leave_request['processed_at'] = datetime.now().isoformat()
            
            logger.info(f"Leave approved: {request_id}, {days_used} days deducted from {user_id}")
            
            response = {
                'success': True,
                'message': 'Leave request approved and processed',
                'request_id': request_id,
                'user_id': user_id,
                'days_deducted': days_used,
                'remaining_leave_days': new_leave_days,
                'database_updated': updated_count > 0,
                'timestamp': datetime.now().isoformat()
            }
        else:
            # 前端拒絕
            leave_request['status'] = 'rejected'
            leave_request['processed_at'] = datetime.now().isoformat()
            
            logger.info(f"Leave rejected: {request_id}")
            
            response = {
                'success': True,
                'message': 'Leave request rejected',
                'request_id': request_id,
                'status': 'rejected',
                'timestamp': datetime.now().isoformat()
            }
        
        del pending_leave_requests[request_id]
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Leave confirm error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def notify_frontend_leave_request(leave_request_data):
    """
    通知前端有新的請假申請
    實際實作可以用 WebSocket、Server-Sent Events 或輪詢
    """
    logger.info(f"Would notify frontend about leave request: {leave_request_data['request_id']}")
    
    # 如果有前端 webhook URL，可以發送 HTTP 請求
    # try:
    #     frontend_webhook_url = "http://localhost:3000/api/leave/notification"
    #     requests.post(frontend_webhook_url, json=leave_request_data, timeout=5)
    #     return True
    # except:
    #     return False
    
    return True

@app.route('/api/frontend/leave/pending', methods=['GET'])
def get_pending_leave_requests():
    """
    前端查詢待處理的請假申請
    """
    try:
        user_id = request.args.get('user_id')  # 可選
        
        if user_id:
            user_requests = {
                req_id: req_data 
                for req_id, req_data in pending_leave_requests.items()
                if req_data['user_id'] == user_id and req_data['status'] == 'pending_frontend'
            }
        else:
            user_requests = {
                req_id: req_data
                for req_id, req_data in pending_leave_requests.items()
                if req_data['status'] == 'pending_frontend'
            }
        
        return jsonify({
            'success': True,
            'pending_requests': user_requests,
            'count': len(user_requests),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Get pending leave requests error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@app.route('/api/frontend/users/<user_id>/data', methods=['GET'])
def frontend_get_user_data(user_id):
    """
    給前端查詢使用者資料的接口
    前端可以用這個接口顯示使用者的最新資料
    """
    try:
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User ID is required'
            }), 400
        
        # 獲取查詢參數
        data_type = request.args.get('type')  # 可選：只查詢特定類型
        format_type = request.args.get('format', 'detailed')  # detailed 或 simple
        
        logger.info(f"Frontend request - User: {user_id}, Type: {data_type}, Format: {format_type}")
        
        # 查詢資料
        user_data = db_handler.get_user_data(user_id, data_type)
        
        if not user_data:
            return jsonify({
                'success': False,
                'message': 'No data found for this user',
                'user_id': user_id,
                'data': {},
                'timestamp': datetime.now().isoformat()
            }), 404
        
        # 根據格式化需求處理資料
        if format_type == 'simple':
            # 簡化格式，只返回值
            simple_data = {}
            for key, info in user_data.items():
                simple_data[key] = info['value']
            user_data = simple_data
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'data': user_data,
            'format': format_type,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Frontend query error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/frontend/users/<user_id>/summary', methods=['GET'])
def frontend_get_user_summary(user_id):
    """
    給前端的聚合資料接口，返回格式化的摘要資訊
    """
    try:
        user_data = db_handler.get_user_data(user_id)
        
        if not user_data:
            return jsonify({
                'success': False,
                'message': 'No data found',
                'summary': {}
            }), 404
        
        # 建立前端友善的摘要格式
        summary = {
            'work_status': {
                'leave_days': user_data.get('leave', {}).get('value', 0),
                'overtime_hours': user_data.get('overtime', {}).get('value', 0),
                'next_bonus_date': user_data.get('bonus', {}).get('value', '')
            },
            'financial': {
                'salary': user_data.get('salary', {}).get('value', 0),
                'meal_allowance': user_data.get('meal', {}).get('value', 0)
            },
            'last_updated': max([
                info.get('updated_at', '') for info in user_data.values()
            ]) if user_data else ''
        }
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'summary': summary,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Summary query error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def notify_frontend(user_id, updated_data):
    """
    可選：當資料更新時通知前端
    可以透過 WebSocket 或者前端定期輪詢
    """
    logger.info(f"Would notify frontend about data update for {user_id}")
    pass

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    return jsonify({
        'status': 'healthy',
        'service': 'Database API',
        'endpoints': {
            'llm_callback': '/api/llm/callback',
            'frontend_data': '/api/frontend/users/<user_id>/data',
            'frontend_summary': '/api/frontend/users/<user_id>/summary'
        },
        'timestamp': datetime.now().isoformat()
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'available_endpoints': [
            'POST /api/llm/callback',
            'GET /api/frontend/users/<user_id>/data',
            'GET /api/frontend/users/<user_id>/summary',
            'GET /health'
        ]
    }), 404

if __name__ == '__main__':
    print("🚀 Starting Database API Server...")
    print("📡 Available endpoints:")
    print("  POST   /api/llm/callback              # LLM 資料回調")
    print("  POST   /api/leave/request             # LLM 請假申請") 
    print("  POST   /api/leave/confirm             # 前端確認請假")
    print("  GET    /api/frontend/leave/pending    # 前端查詢待處理請假")
    print("  GET    /api/frontend/users/<id>/data  # 前端查詢使用者資料") 
    print("  GET    /api/frontend/users/<id>/summary # 前端摘要")
    print("  GET    /health                       # 健康檢查")
    print("")
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )