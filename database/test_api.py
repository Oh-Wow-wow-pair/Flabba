# test_new_api.py
import requests
import json
import time
from datetime import datetime

# API 基礎 URL
BASE_URL = "http://localhost:5001"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"🧪 {title}")
    print('='*60)

def print_response(response, title):
    print(f"\n📡 {title}")
    print(f"Status Code: {response.status_code}")
    if response.headers.get('content-type', '').startswith('application/json'):
        try:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2, ensure_ascii=False)}")
        except:
            print(f"Response: {response.text}")
    else:
        print(f"Response: {response.text}")
    print("-" * 50)

def test_health_check():
    """測試健康檢查"""
    print_section("健康檢查")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        print_response(response, "Health Check")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 健康檢查失敗: {e}")
        return False

def test_llm_callback():
    """測試 LLM 回調接口"""
    print_section("LLM 回調接口測試")
    
    # 測試案例 1: 正常資料
    test_data_1 = {
        "user_id": "test_user_001",
        "extracted_data": {
            "leave_days": 15.5,
            "meal_allowance": 2000,
            "overtime_hours": 30.0,
            "salary": 55000,
            "next_bonus_date": "2025-12-15"
        },
        "conversation_id": "conv_123",
        "timestamp": datetime.now().isoformat()
    }
    
    response = requests.post(
        f"{BASE_URL}/api/llm/callback",
        json=test_data_1
    )
    print_response(response, "LLM Callback - 完整資料")
    
    # 測試案例 2: 部分資料
    test_data_2 = {
        "user_id": "test_user_002",
        "extracted_data": {
            "leave_days": 8.0,
            "overtime_hours": 25.5
        },
        "conversation_id": "conv_124"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/llm/callback",
        json=test_data_2
    )
    print_response(response, "LLM Callback - 部分資料")
    
    # 測試案例 3: 錯誤格式
    test_data_3 = {
        "user_id": "test_user_003"
        # 缺少 extracted_data
    }
    
    response = requests.post(
        f"{BASE_URL}/api/llm/callback",
        json=test_data_3
    )
    print_response(response, "LLM Callback - 錯誤格式 (應該失敗)")
    
    return True

def test_frontend_queries():
    """測試前端查詢接口"""
    print_section("前端查詢接口測試")
    
    # 查詢所有資料
    response = requests.get(f"{BASE_URL}/api/frontend/users/test_user_001/data")
    print_response(response, "查詢使用者所有資料")
    
    # 查詢特定類型資料
    response = requests.get(f"{BASE_URL}/api/frontend/users/test_user_001/data?type=leave")
    print_response(response, "查詢特定類型資料 (leave)")
    
    # 查詢簡化格式
    response = requests.get(f"{BASE_URL}/api/frontend/users/test_user_001/data?format=simple")
    print_response(response, "查詢簡化格式資料")
    
    # 查詢不存在的使用者
    response = requests.get(f"{BASE_URL}/api/frontend/users/nonexistent_user/data")
    print_response(response, "查詢不存在的使用者 (應該 404)")
    
    return True

def test_frontend_summary():
    """測試前端摘要接口"""
    print_section("前端摘要接口測試")
    
    # 查詢使用者摘要
    response = requests.get(f"{BASE_URL}/api/frontend/users/test_user_001/summary")
    print_response(response, "查詢使用者摘要")
    
    response = requests.get(f"{BASE_URL}/api/frontend/users/test_user_002/summary")
    print_response(response, "查詢另一個使用者摘要")
    
    # 查詢不存在使用者的摘要
    response = requests.get(f"{BASE_URL}/api/frontend/users/nonexistent_user/summary")
    print_response(response, "查詢不存在使用者的摘要 (應該 404)")
    
    return True

def test_error_handling():
    """測試錯誤處理"""
    print_section("錯誤處理測試")
    
    # 測試不存在的端點
    response = requests.get(f"{BASE_URL}/api/nonexistent/endpoint")
    print_response(response, "不存在的端點 (應該 404)")
    
    # 測試錯誤的 HTTP 方法
    response = requests.post(f"{BASE_URL}/api/frontend/users/test_user_001/data")
    print_response(response, "錯誤的 HTTP 方法 (應該 405)")
    
    # 測試空的 POST 資料
    response = requests.post(f"{BASE_URL}/api/llm/callback")
    print_response(response, "空的 POST 資料 (應該 400)")
    
    return True

def test_data_flow():
    """測試完整資料流程"""
    print_section("完整資料流程測試")
    
    user_id = "flow_test_user"
    
    # 1. LLM 發送資料
    print("🔄 步驟 1: LLM 發送資料到資料庫")
    llm_data = {
        "user_id": user_id,
        "extracted_data": {
            "leave_days": 20.0,
            "meal_allowance": 3000,
            "salary": 60000
        },
        "conversation_id": "flow_test_conv"
    }
    
    response = requests.post(f"{BASE_URL}/api/llm/callback", json=llm_data)
    print_response(response, "LLM 資料提交")
    
    # 等待一下確保資料已儲存
    time.sleep(0.5)
    
    # 2. 前端查詢資料
    print("🔄 步驟 2: 前端查詢使用者資料")
    response = requests.get(f"{BASE_URL}/api/frontend/users/{user_id}/data")
    print_response(response, "前端查詢結果")
    
    # 3. 前端查詢摘要
    print("🔄 步驟 3: 前端查詢摘要")
    response = requests.get(f"{BASE_URL}/api/frontend/users/{user_id}/summary")
    print_response(response, "前端摘要結果")
    
    # 4. LLM 更新部分資料
    print("🔄 步驟 4: LLM 更新部分資料")
    update_data = {
        "user_id": user_id,
        "extracted_data": {
            "leave_days": 18.0,  # 使用了 2 天特休
            "overtime_hours": 15.0  # 新增加班資料
        },
        "conversation_id": "flow_test_conv_2"
    }
    
    response = requests.post(f"{BASE_URL}/api/llm/callback", json=update_data)
    print_response(response, "LLM 資料更新")
    
    # 5. 前端再次查詢確認更新
    print("🔄 步驟 5: 前端確認資料更新")
    response = requests.get(f"{BASE_URL}/api/frontend/users/{user_id}/summary")
    print_response(response, "更新後摘要")
    
    return True

def run_all_tests():
    """執行所有測試"""
    print("🚀 開始測試新的 API 服務器")
    print(f"目標 URL: {BASE_URL}")
    print("請確保 API 服務器正在運行 (python api_server.py)")
    
    tests = [
        ("健康檢查", test_health_check),
        ("LLM 回調接口", test_llm_callback),
        ("前端查詢接口", test_frontend_queries),
        ("前端摘要接口", test_frontend_summary),
        ("錯誤處理", test_error_handling),
        ("完整資料流程", test_data_flow)
    ]
    
    results = {}
    
    try:
        for test_name, test_func in tests:
            try:
                success = test_func()
                results[test_name] = "✅ 通過" if success else "❌ 失敗"
            except Exception as e:
                results[test_name] = f"❌ 異常: {e}"
                print(f"測試 {test_name} 發生異常: {e}")
    
    except KeyboardInterrupt:
        print("\n⚠️ 測試被使用者中斷")
    
    except requests.exceptions.ConnectionError:
        print("\n❌ 無法連接到 API 服務器")
        print("請確保服務器正在運行: python api_server.py")
        return
    
    # 顯示測試結果摘要
    print_section("測試結果摘要")
    for test_name, result in results.items():
        print(f"{result} {test_name}")
    
    passed = sum(1 for r in results.values() if r.startswith("✅"))
    total = len(results)
    print(f"\n📊 總計: {passed}/{total} 個測試通過")
    
    if passed == total:
        print("🎉 所有測試都通過了！")
    else:
        print("⚠️ 有部分測試失敗，請檢查上面的詳細資訊")

if __name__ == "__main__":
    run_all_tests()