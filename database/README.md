# 📡 Database API 整合文件

**服務地址**: `http://localhost:5001`  
**版本**: 1.1  
**更新時間**: 2025-09-20

## 🎯 API 概述

本服務提供使用者資料管理和請假記錄功能，支援 LLM 服務和前端的資料存取需求。

## 📋 資料類型定義

### 使用者資料欄位

| 欄位名稱 | 資料類型 | 單位 | 說明 |
|---------|---------|------|------|
| `leave_days` | `number` | `days` | 剩餘特休天數 |
| `meal_allowance` | `number` | `ntd` | 剩餘餐補金額 |
| `overtime_hours` | `number` | `hours` | 累計加班時數 |
| `salary` | `number` | `ntd` | 月薪 |
| `next_bonus_date` | `string` | `YYYY-MM-DD` | 下次獎金發放日期 |

### 請假類型處理規則

| 類型代碼 | 說明 | 是否扣除特休 |
|---------|------|-------------|
| `annual_leave` | 特休假 | ✅ 是 |
| `sick_leave` | 病假 | ❌ 否 |
| `personal_leave` | 事假 | ❌ 否 |
| `marriage_leave` | 婚假 | ❌ 否 |
| `funeral_leave` | 喪假 | ❌ 否 |
| `maternity_leave` | 產假 | ❌ 否 |
| `paternity_leave` | 陪產假 | ❌ 否 |

**重要說明**: 只有 `annual_leave` (特休假) 會扣除使用者的特休天數，其他假別僅做記錄不影響特休餘額。

## 🤖 LLM 服務整合

### 使用者資料更新

**端點**: `POST /api/llm/callback`

**用途**: LLM 分析對話後，提取的使用者資料發送到這裡進行儲存

**請求格式**:
```json
{
    "user_id": "user001",
    "extracted_data": {
        "leave_days": 12.5,
        "meal_allowance": 1500,
        "overtime_hours": 25.0,
        "salary": 50000,
        "next_bonus_date": "2025-12-15"
    }
}
```

**回應格式**:
```json
{
    "success": true,
    "message": "Data updated successfully",
    "user_id": "user001",
    "updated_count": 3,
    "current_data": {
        "leave": {
            "value": 12.5,
            "unit": "days",
            "description": "剩餘特休天數",
            "updated_at": "2025-09-20T14:30:00"
        }
        // ... 其他資料
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

**整合範例**:
```python
import requests

def update_user_data(user_id, extracted_data):
    response = requests.post(
        'http://localhost:5001/api/llm/callback',
        json={
            'user_id': user_id,
            'extracted_data': extracted_data
        }
    )
    return response.json()

# 使用範例
result = update_user_data('user001', {
    'leave_days': 15.0,
    'meal_allowance': 2000
})
```

## 🖥️ 前端整合

### 1. 查詢使用者資料

**端點**: `GET /api/frontend/users/{user_id}/data`

**查詢參數**:
- `type`: 可選，查詢特定資料類型 (`leave`, `meal`, `overtime`, `salary`, `bonus`)
- `format`: 可選，回應格式 (`detailed` 預設 | `simple`)

**使用範例**:
```bash
GET /api/frontend/users/user001/data           # 所有資料
GET /api/frontend/users/user001/data?type=leave # 只查詢特休
GET /api/frontend/users/user001/data?format=simple # 簡化格式
```

**回應格式 (detailed)**:
```json
{
    "success": true,
    "user_id": "user001",
    "data": {
        "leave": {
            "value": 12.5,
            "unit": "days",
            "description": "剩餘特休天數",
            "updated_at": "2025-09-20T14:30:00"
        },
        "meal": {
            "value": 1500,
            "unit": "ntd",
            "description": "剩餘餐補",
            "updated_at": "2025-09-20T14:30:00"
        }
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

**回應格式 (simple)**:
```json
{
    "success": true,
    "user_id": "user001",
    "data": {
        "leave": 12.5,
        "meal": 1500,
        "overtime": 25.0,
        "salary": 50000,
        "bonus": "2025-12-15"
    },
    "format": "simple",
    "timestamp": "2025-09-20T14:30:00"
}
```

### 2. 查詢使用者摘要

**端點**: `GET /api/frontend/users/{user_id}/summary`

**用途**: 取得格式化的使用者資訊摘要，適合在 UI 上顯示

**回應格式**:
```json
{
    "success": true,
    "user_id": "user001",
    "summary": {
        "work_status": {
            "leave_days": 12.5,
            "overtime_hours": 25.0,
            "next_bonus_date": "2025-12-15"
        },
        "financial": {
            "salary": 50000,
            "meal_allowance": 1500
        },
        "last_updated": "2025-09-20T14:30:00"
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

### 3. 記錄請假資訊

**端點**: `POST /api/leave/record`

**用途**: 前端確認請假後，將請假資訊記錄到系統中

**請求格式**:
```json
{
    "user_id": "user001",
    "leave_type": "annual_leave",
    "start_date": "2025-09-25",
    "end_date": "2025-09-26",
    "days": 2,
    "reason": "個人事務",
    "approved_by": "manager",
    "approved_at": "2025-09-20T14:30:00"
}
```

**回應格式 (特休假)**:
```json
{
    "success": true,
    "message": "Leave record saved successfully",
    "user_id": "user001",
    "leave_record": {
        "user_id": "user001",
        "leave_type": "annual_leave",
        "start_date": "2025-09-25",
        "end_date": "2025-09-26",
        "days": 2,
        "reason": "個人事務",
        "previous_leave_days": 15.0,
        "remaining_leave_days": 13.0
    },
    "leave_type": "annual_leave",
    "annual_leave_deducted": true,
    "database_updated": true,
    "timestamp": "2025-09-20T14:30:00"
}
```

**回應格式 (非特休假)**:
```json
{
    "success": true,
    "message": "Leave record saved successfully",
    "user_id": "user001",
    "leave_record": {
        "user_id": "user001",
        "leave_type": "sick_leave",
        "start_date": "2025-09-20",
        "end_date": "2025-09-20",
        "days": 1,
        "reason": "身體不適",
        "previous_leave_days": 15.0,
        "remaining_leave_days": 15.0
    },
    "leave_type": "sick_leave",
    "annual_leave_deducted": false,
    "database_updated": false,
    "timestamp": "2025-09-20T14:30:00"
}
```

**前端整合範例**:
```javascript
// 查詢使用者資料
async function getUserData(userId) {
    const response = await fetch(`http://localhost:5001/api/frontend/users/${userId}/summary`);
    return await response.json();
}

// 記錄請假
async function recordLeave(leaveData) {
    const response = await fetch('http://localhost:5001/api/leave/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveData)
    });
    return await response.json();
}

// 使用範例
const userData = await getUserData('user001');
console.log(`特休天數: ${userData.summary.work_status.leave_days}`);

const leaveResult = await recordLeave({
    user_id: 'user001',
    leave_type: 'annual_leave',
    start_date: '2025-09-25',
    end_date: '2025-09-25',
    days: 1,
    reason: '個人事務'
});
```

## 🔧 通用格式

### 健康檢查

**端點**: `GET /health`

**回應格式**:
```json
{
    "status": "healthy",
    "service": "Database API",
    "endpoints": {
        "llm_callback": "/api/llm/callback",
        "leave_record": "/api/leave/record",
        "frontend_data": "/api/frontend/users/<user_id>/data",
        "frontend_summary": "/api/frontend/users/<user_id>/summary"
    },
    "timestamp": "2025-09-20T14:30:00"
}
```

### 錯誤回應

所有錯誤都會回傳統一格式：

```json
{
    "success": false,
    "error": "錯誤描述",
    "timestamp": "2025-09-20T14:30:00"
}
```

**常見錯誤碼**:
- `400`: 請求格式錯誤或缺少必要欄位
- `404`: 資源不存在 (使用者資料不存在)
- `500`: 伺服器內部錯誤

## 🚀 快速測試

### 使用 curl 測試

```bash
# 健康檢查
curl http://localhost:5001/health

# LLM 更新資料
curl -X POST http://localhost:5001/api/llm/callback \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user001", "extracted_data": {"leave_days": 15.0}}'

# 查詢使用者摘要
curl http://localhost:5001/api/frontend/users/user001/summary

# 記錄特休假
curl -X POST http://localhost:5001/api/leave/record \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user001",
    "leave_type": "annual_leave",
    "start_date": "2025-09-25",
    "end_date": "2025-09-25",
    "days": 1,
    "reason": "測試請假"
  }'

# 記錄病假 (不扣特休)
curl -X POST http://localhost:5001/api/leave/record \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user001", 
    "leave_type": "sick_leave",
    "start_date": "2025-09-26",
    "end_date": "2025-09-26",
    "days": 1,
    "reason": "身體不適"
  }'
```

### 使用 Python 測試

```python
import requests

# 執行快速測試
def quick_test():
    base_url = "http://localhost:5001"
    
    # 健康檢查
    health = requests.get(f"{base_url}/health")
    print("健康檢查:", health.json()['status'])
    
    # LLM 更新資料
    llm_data = {
        "user_id": "test_user",
        "extracted_data": {"leave_days": 20.0, "salary": 50000}
    }
    result = requests.post(f"{base_url}/api/llm/callback", json=llm_data)
    print("資料更新:", result.json()['success'])
    
    # 查詢資料
    user_data = requests.get(f"{base_url}/api/frontend/users/test_user/summary")
    summary = user_data.json()['summary']
    print("特休天數:", summary['work_status']['leave_days'])
    
    # 記錄請假
    leave_data = {
        "user_id": "test_user",
        "leave_type": "annual_leave",
        "start_date": "2025-09-25",
        "end_date": "2025-09-25", 
        "days": 1,
        "reason": "測試"
    }
    leave_result = requests.post(f"{base_url}/api/leave/record", json=leave_data)
    print("請假記錄:", leave_result.json()['annual_leave_deducted'])

if __name__ == "__main__":
    quick_test()
```

## ⚠️ 注意事項

1. **資料持久性**: 使用者資料儲存在 SQLite 資料庫中
2. **請假邏輯**: 只有特休假會扣除特休天數，其他假別僅記錄
3. **資料驗證**: API 會驗證必要欄位和基本格式
4. **並發處理**: 支援多個同時請求
5. **日誌記錄**: 所有請假記錄都會記錄到伺服器日誌中

## 📞 支援

- 健康檢查: `GET /health`
- 服務狀態確認: 檢查回應中的 `success` 欄位
- 錯誤排查: 查看伺服器日誌或錯誤回應中的 `error` 欄位