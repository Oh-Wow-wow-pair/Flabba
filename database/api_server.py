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

def handle_errors(f):
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"API Error: {e}")
            return jsonify({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500
    wrapper.__name__ = f.__name__
    return wrapper

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'User Data API'
    })

@app.route('/api/users/<user_id>/data', methods=['POST'])
@handle_errors
def update_user_data(user_id):
    if not user_id:
        return jsonify({
            'success': False,
            'error': 'User ID is required'
        }), 400
    
    data = request.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400
    
    logger.info(f"Updating data for user: {user_id}, data: {data}")
    
    updated_count = db_handler.process_backend_data(user_id, data)
    
    updated_data = db_handler.get_user_data(user_id)
    
    return jsonify({
        'success': True,
        'message': f'Successfully updated {updated_count} records',
        'user_id': user_id,
        'updated_count': updated_count,
        'data': updated_data,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/users/<user_id>/data', methods=['GET'])
@handle_errors
def get_user_data(user_id):
    if not user_id:
        return jsonify({
            'success': False,
            'error': 'User ID is required'
        }), 400
    
    data_type = request.args.get('type')
    
    logger.info(f"Getting data for user: {user_id}, type: {data_type}")
    
    user_data = db_handler.get_user_data(user_id, data_type)
    
    if not user_data:
        return jsonify({
            'success': False,
            'message': 'No data found for this user',
            'user_id': user_id,
            'data': {},
            'timestamp': datetime.now().isoformat()
        }), 404
    
    return jsonify({
        'success': True,
        'user_id': user_id,
        'data': user_data,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/users/<user_id>/data/<data_type>', methods=['GET'])
@handle_errors
def get_specific_user_data(user_id, data_type):
    if not user_id or not data_type:
        return jsonify({
            'success': False,
            'error': 'User ID and data type are required'
        }), 400
    
    logger.info(f"Getting {data_type} data for user: {user_id}")
    
    user_data = db_handler.get_user_data(user_id, data_type)
    
    if not user_data:
        return jsonify({
            'success': False,
            'message': f'No {data_type} data found for this user',
            'user_id': user_id,
            'data_type': data_type,
            'data': {},
            'timestamp': datetime.now().isoformat()
        }), 404
    
    return jsonify({
        'success': True,
        'user_id': user_id,
        'data_type': data_type,
        'data': user_data,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/users/batch', methods=['POST'])
@handle_errors
def batch_update_users():
    data = request.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': 'No data provided'
        }), 400
    
    logger.info(f"Batch updating users: {list(data.keys())}")
    
    results = {}
    total_updates = 0
    
    for user_id, user_data in data.items():
        try:
            updated_count = db_handler.process_backend_data(user_id, user_data)
            results[user_id] = {
                'success': True,
                'updated_count': updated_count
            }
            total_updates += updated_count
        except Exception as e:
            results[user_id] = {
                'success': False,
                'error': str(e)
            }
    
    return jsonify({
        'success': True,
        'message': f'Batch update completed. Total updates: {total_updates}',
        'results': results,
        'total_updates': total_updates,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/users/<user_id>/data/<data_type>', methods=['DELETE'])
@handle_errors
def delete_user_data(user_id, data_type):
    return jsonify({
        'success': False,
        'message': 'Delete operation not supported yet',
        'timestamp': datetime.now().isoformat()
    }), 501

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'timestamp': datetime.now().isoformat()
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'success': False,
        'error': 'Method not allowed',
        'timestamp': datetime.now().isoformat()
    }), 405

if __name__ == '__main__':
    """
    print("🚀 Starting User Data API Server...")
    print("📡 Available endpoints:")
    print("  GET    /health")
    print("  POST   /api/users/<user_id>/data")
    print("  GET    /api/users/<user_id>/data")
    print("  GET    /api/users/<user_id>/data/<data_type>")
    print("  POST   /api/users/batch")
    print("  DELETE /api/users/<user_id>/data/<data_type>")
    print("")
    """
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )