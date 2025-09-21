from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging
from datetime import datetime
from data_handler import UserDataHandler

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

db_handler = UserDataHandler()

@app.route('/api/llm/callback', methods=['POST'])
def llm_callback():
    """
    給 LLM 服務調用的回調接口
    LLM 分析完對話後，會把提取的使用者資料發送到這裡
    """
    try:
        data = request.get_json()
        
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

# === 請假記錄接口 ===
@app.route('/api/leave/record', methods=['POST'])
def record_leave():
    """
    前端確認請假後，記錄請假資訊
    前端會把已經確認的請假資料發送過來，我們只需要記錄即可
    """
    try:
        data = request.get_json()
        
        # 檢查必要欄位
        required_fields = ['user_id', 'leave_type', 'start_date', 'end_date', 'days']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {missing_fields}'
            }), 400
        
        user_id = data['user_id']
        days_used = data['days']
        
        # 驗證天數不能為負數
        if days_used < 0:
            return jsonify({
                'success': False,
                'error': 'Days cannot be negative'
            }), 400
        
        logger.info(f"Recording leave for user {user_id}: {days_used} days, {data['start_date']} to {data['end_date']}")
        
        # 根據請假類型決定是否扣除特休
        leave_type = data['leave_type']
        updated_count = 0
        current_leave_days = 0
        new_leave_days = 0
        
        if leave_type == 'annual_leave':  # 只有特休假才扣除特休天數
            # 獲取現有特休天數
            current_data = db_handler.get_user_data(user_id, 'leave')
            current_leave_days = current_data.get('value', 0) if current_data else 0
            
            # 扣除請假天數
            new_leave_days = max(0, current_leave_days - days_used)
            
            # 更新資料庫中的特休天數
            updated_count = db_handler.process_backend_data(user_id, {
                'leave_days': new_leave_days
            })
            
            logger.info(f"Annual leave deducted: {days_used} days from {user_id}, remaining: {new_leave_days}")
        else:
            # 其他假別不扣除特休，只記錄
            logger.info(f"Non-annual leave recorded: {leave_type} for {user_id}, {days_used} days")
            
            # 獲取現有特休天數以供記錄
            current_data = db_handler.get_user_data(user_id, 'leave')
            current_leave_days = current_data.get('value', 0) if current_data else 0
            new_leave_days = current_leave_days  # 不變動
        
        # 準備請假記錄
        leave_record = {
            'user_id': user_id,
            'leave_type': data['leave_type'],
            'start_date': data['start_date'],
            'end_date': data['end_date'], 
            'days': days_used,
            'reason': data.get('reason', ''),
            'approved_by': data.get('approved_by', 'system'),
            'approved_at': data.get('approved_at', datetime.now().isoformat()),
            'recorded_at': datetime.now().isoformat(),
            'previous_leave_days': current_leave_days,
            'remaining_leave_days': new_leave_days
        }
        
        # 記錄到日誌 (未來可以考慮建立 leave_history 表)
        logger.info(f"Leave recorded: {json.dumps(leave_record, ensure_ascii=False)}")
        
        return jsonify({
            'success': True,
            'message': 'Leave record saved successfully',
            'user_id': user_id,
            'leave_record': leave_record,
            'leave_type': leave_type,
            'annual_leave_deducted': leave_type == 'annual_leave',
            'database_updated': updated_count > 0,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Record leave error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

# === 前端查詢接口 ===
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

# === 健康檢查 ===
@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    return jsonify({
        'status': 'healthy',
        'service': 'Database API',
        'endpoints': {
            'llm_callback': '/api/llm/callback',
            'leave_record': '/api/leave/record',
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
            'POST /api/leave/record',
            'GET /api/frontend/users/<user_id>/data',
            'GET /api/frontend/users/<user_id>/summary',
            'GET /health'
        ]
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'success': False,
        'error': 'Method not allowed',
        'timestamp': datetime.now().isoformat()
    }), 405

if __name__ == '__main__':
    print("🚀 Starting Database API Server...")
    print("📡 Available endpoints:")
    print("  POST   /api/llm/callback              # LLM 資料回調")
    print("  POST   /api/leave/record              # 前端記錄請假") 
    print("  GET    /api/frontend/users/<id>/data  # 前端查詢使用者資料") 
    print("  GET    /api/frontend/users/<id>/summary # 前端摘要")
    print("  GET    /health                       # 健康檢查")
    print("")
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )