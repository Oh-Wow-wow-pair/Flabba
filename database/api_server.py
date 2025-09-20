from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging
import requests
from datetime import datetime
from data_handler import UserDataHandler

app = Flask(__name__)
CORS(app)  # 允許前端跨域請求

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 初始化資料處理器
db_handler = UserDataHandler()

# === LLM 回調接口 ===
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
        #     },
        #     "conversation_id": "conv_123",
        #     "timestamp": "2025-09-20T14:30:00"
        # }
        
        if not data or 'user_id' not in data or 'extracted_data' not in data:
            return jsonify({
                'success': False,
                'error': 'Invalid data format. Required: user_id, extracted_data'
            }), 400
        
        user_id = data['user_id']
        extracted_data = data['extracted_data']
        conversation_id = data.get('conversation_id', '')
        
        logger.info(f"LLM callback - User: {user_id}, Data: {extracted_data}")
        
        # 儲存資料到資料庫
        updated_count = db_handler.process_backend_data(user_id, extracted_data)
        
        # 獲取更新後的完整資料
        user_data = db_handler.get_user_data(user_id)
        
        # 通知前端有新資料更新（如果需要的話）
        # notify_frontend(user_id, user_data)
        
        response = {
            'success': True,
            'message': f'Data updated successfully',
            'user_id': user_id,
            'updated_count': updated_count,
            'conversation_id': conversation_id,
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

# === 前端專用的聚合資料接口 ===
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

# === WebSocket 通知 (可選) ===
def notify_frontend(user_id, updated_data):
    """
    可選：當資料更新時通知前端
    可以透過 WebSocket 或者前端定期輪詢
    """
    # 這裡可以實作 WebSocket 或其他即時通知機制
    logger.info(f"Would notify frontend about data update for {user_id}")
    pass

# === 健康檢查 ===
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

# === 錯誤處理 ===
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
    print("  POST   /api/llm/callback              # LLM 回調接口")
    print("  GET    /api/frontend/users/<id>/data  # 前端查詢接口") 
    print("  GET    /api/frontend/users/<id>/summary # 前端摘要接口")
    print("  GET    /health                       # 健康檢查")
    print("")
    
    app.run(
        host='0.0.0.0',
        port=5001,  # 使用不同的 port 避免衝突
        debug=True
    )