# quick_test.py - 快速測試版本
import requests
import json

BASE_URL = "http://localhost:5001"

def quick_test():
    """快速測試所有核心功能"""
    print("🚀 快速 API 測試")
    print("-" * 40)
    
    try:
        # 1. 健康檢查
        print("1️⃣ 健康檢查...")
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ API 服務正常")
        else:
            print(f"❌ API 服務異常 ({response.status_code})")
            return
        
        # 2. LLM 回調測試
        print("\n2️⃣ LLM 回調測試...")
        llm_data = {
            "user_id": "quick_test_user",
            "extracted_data": {
                "leave_days": 15.0,
                "meal_allowance": 2000,
                "salary": 50000
            }
        }
        response = requests.post(f"{BASE_URL}/api/llm/callback", json=llm_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ LLM 回調成功，更新了 {result.get('updated_count', 0)} 筆資料")
        else:
            print(f"❌ LLM 回調失敗 ({response.status_code})")
        
        # 3. 前端查詢測試
        print("\n3️⃣ 前端查詢測試...")
        response = requests.get(f"{BASE_URL}/api/frontend/users/quick_test_user/summary")
        if response.status_code == 200:
            result = response.json()
            summary = result.get('summary', {})
            work_status = summary.get('work_status', {})
            print(f"✅ 前端查詢成功")
            print(f"   特休天數: {work_status.get('leave_days', 0)} 天")
            print(f"   餐補餘額: {summary.get('financial', {}).get('meal_allowance', 0)} 元")
        else:
            print(f"❌ 前端查詢失敗 ({response.status_code})")
        
        # 4. 請假記錄測試
        print("\n4️⃣ 請假記錄測試...")
        leave_data = {
            "user_id": "quick_test_user",
            "leave_type": "annual_leave",
            "start_date": "2025-09-25",
            "end_date": "2025-09-25",
            "days": 1,
            "reason": "快速測試請假"
        }
        response = requests.post(f"{BASE_URL}/api/leave/record", json=leave_data)
        if response.status_code == 200:
            result = response.json()
            leave_record = result.get('leave_record', {})
            remaining = leave_record.get('remaining_leave_days', 0)
            print(f"✅ 請假記錄成功，剩餘特休: {remaining} 天")
        else:
            print(f"❌ 請假記錄失敗 ({response.status_code})")
        
        # 5. 最終驗證
        print("\n5️⃣ 最終驗證...")
        response = requests.get(f"{BASE_URL}/api/frontend/users/quick_test_user/data?type=leave")
        if response.status_code == 200:
            result = response.json()
            final_leave = result.get('data', {}).get('value', 0)
            print(f"✅ 最終特休天數: {final_leave} 天")
            
            if final_leave == 14:  # 15 - 1 = 14
                print("🎉 所有功能運作正常！")
            else:
                print("⚠️ 特休天數計算可能有誤")
        else:
            print(f"❌ 最終驗證失敗 ({response.status_code})")
        
        print("\n✨ 快速測試完成！")
        
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到 API 服務器")
        print("請確保服務器正在運行: python api_server.py")
    except Exception as e:
        print(f"❌ 測試過程中發生錯誤: {e}")

if __name__ == "__main__":
    quick_test()