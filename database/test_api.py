import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5001"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"🧪 {title}")
    print('='*60)

def print_response(response, title):
    print(f"\n📡 {title}")
    print(f"Status Code: {response.status_code}")
    try:
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return result
    except:
        print(f"Response: {response.text}")
        return None

def test_leave_request_flow():
    """測試完整的請假申請流程"""
    print_section("完整請假申請流程測試")
    
    user_id = "leave_test_user"
    
    # 步驟 0: 先給使用者一些特休天數
    print("🔧 步驟 0: 初始化使用者特休天數")
    init_data = {
        "user_id": user_id,
        "extracted_data": {
            "leave_days": 20.0  # 給 20 天特休
        }
    }
    response = requests.post(f"{BASE_URL}/api/llm/callback", json=init_data)
    print_response(response, "初始化特休天數")
    
    # 步驟 1: LLM 發送請假申請
    print("🔄 步驟 1: LLM 發送請假申請")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    day_after = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    
    leave_data = {
        "user_id": user_id,
        "leave_type": "annual_leave",
        "start_date": tomorrow,
        "end_date": day_after,
        "days": 2,
        "reason": "個人事務"
    }
    
    response = requests.post(f"{BASE_URL}/api/leave/request", json=leave_data)
    result = print_response(response, "LLM 請假申請")
    
    if not result or not result.get('success'):
        print("❌ 請假申請失敗，終止測試")
        return
    
    request_id = result.get('request_id')
    print(f"✅ 請假申請已建立，ID: {request_id}")
    
    # 步驟 2: 前端查詢待處理申請
    print("🔄 步驟 2: 前端查詢待處理申請")
    response = requests.get(f"{BASE_URL}/api/frontend/leave/pending")
    result = print_response(response, "前端查詢待處理申請")
    
    pending_requests = result.get('pending_requests', {})
    if request_id not in pending_requests:
        print("❌ 找不到剛建立的請假申請")
        return
    
    print(f"✅ 找到待處理申請: {request_id}")
    
    # 步驟 3: 前端確認 OK
    print("🔄 步驟 3: 前端確認請假申請")
    confirm_data = {
        "request_id": request_id,
        "approved": True,
        "message": "請假申請已通過"
    }
    
    response = requests.post(f"{BASE_URL}/api/leave/confirm", json=confirm_data)
    result = print_response(response, "前端確認請假")
    
    if result and result.get('success'):
        remaining_days = result.get('remaining_leave_days')
        print(f"✅ 請假確認成功，剩餘特休: {remaining_days} 天")
    
    # 步驟 4: 驗證資料庫更新
    print("🔄 步驟 4: 驗證資料庫更新")
    response = requests.get(f"{BASE_URL}/api/frontend/users/{user_id}/data")
    result = print_response(response, "查詢更新後的使用者資料")
    
    if result and result.get('success'):
        leave_data = result.get('data', {}).get('leave', {})
        current_leave_days = leave_data.get('value', 0)
        print(f"✅ 資料庫更新確認，目前特休天數: {current_leave_days}")
        
        expected_days = 18  # 20 - 2 = 18
        if abs(current_leave_days - expected_days) < 0.1:
            print(f"🎉 特休天數正確扣除！ (20 → {current_leave_days})")
        else:
            print(f"⚠️ 特休天數可能有誤，預期: {expected_days}，實際: {current_leave_days}")

def test_leave_rejection():
    """測試請假拒絕流程"""
    print_section("請假拒絕流程測試")
    
    user_id = "reject_test_user"
    
    # 發送請假申請
    leave_data = {
        "user_id": user_id,
        "leave_type": "sick_leave",
        "start_date": "2025-09-25",
        "end_date": "2025-09-25",
        "days": 1,
        "reason": "身體不適"
    }
    
    response = requests.post(f"{BASE_URL}/api/leave/request", json=leave_data)
    result = print_response(response, "請假申請")
    
    if not result or not result.get('success'):
        print("❌ 請假申請失敗")
        return
    
    request_id = result.get('request_id')
    
    # 前端拒絕申請
    confirm_data = {
        "request_id": request_id,
        "approved": False,
        "message": "申請資料不完整，請重新申請"
    }
    
    response = requests.post(f"{BASE_URL}/api/leave/confirm", json=confirm_data)
    result = print_response(response, "前端拒絕請假")
    
    if result and result.get('success'):
        status = result.get('status')
        print(f"✅ 請假拒絕處理成功，狀態: {status}")

def test_error_cases():
    """測試錯誤情況"""
    print_section("錯誤情況測試")
    
    # 測試缺少必要欄位
    print("🧪 測試缺少必要欄位")
    invalid_data = {
        "user_id": "test_user"
        # 缺少其他必要欄位
    }
    response = requests.post(f"{BASE_URL}/api/leave/request", json=invalid_data)
    print_response(response, "缺少必要欄位 (應該 400)")
    
    print("🧪 測試確認不存在的申請")
    invalid_confirm = {
        "request_id": "nonexistent_id",
        "approved": True
    }
    response = requests.post(f"{BASE_URL}/api/leave/confirm", json=invalid_confirm)
    print_response(response, "確認不存在申請 (應該 404)")

def test_frontend_query():
    """測試前端查詢功能"""
    print_section("前端查詢功能測試")
    
    # 查詢所有待處理申請
    response = requests.get(f"{BASE_URL}/api/frontend/leave/pending")
    print_response(response, "查詢所有待處理申請")
    
    # 查詢特定使用者的申請
    response = requests.get(f"{BASE_URL}/api/frontend/leave/pending?user_id=leave_test_user")
    print_response(response, "查詢特定使用者申請")

def run_leave_tests():
    """執行所有請假相關測試"""
    print("🚀 開始測試請假系統")
    print(f"目標 URL: {BASE_URL}")
    print("請確保 API 服務器正在運行")
    
    try:
        # 健康檢查
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code != 200:
            print("❌ API 服務器不可用")
            return
        
        test_leave_request_flow()
        time.sleep(1)  # 等待一下
        
        test_leave_rejection()
        time.sleep(1)
        
        test_error_cases()
        time.sleep(1)
        
        test_frontend_query()
        
        print_section("測試完成")
        print("🎉 所有請假系統測試完成！")
        
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到 API 服務器，請先啟動服務器")
    except Exception as e:
        print(f"❌ 測試過程中發生錯誤: {e}")

if __name__ == "__main__":
    run_leave_tests()