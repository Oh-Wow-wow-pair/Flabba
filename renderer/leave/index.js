const leave_btn = document.getElementById('leave-send');

if (window.electronAPI) {
    window.electronAPI.sendLeaveData((event, data) => {
        document.getElementById("employee-name").value = data.name;
        document.getElementById("employee-id").value = data.id;
        document.getElementById("department").value = data.department;

        // Get the input element by its ID
        const startDateInput = document.getElementById('start-date');

        // Create a new Date object for a specific date (e.g., January 15, 2025)
        const specificDate = new Date('2025-01-15');

        // Format the date to YYYY-MM-DD
        const year = specificDate.getFullYear();
        const month = String(specificDate.getMonth() + 1).padStart(2, '0');
        const day = String(specificDate.getDate()).padStart(2, '0');

        const formattedDate = `${year}-${month}-${day}`;

        // Set the value of the input
        startDateInput.value = formattedDate;

        // Get the input element by its ID
        const endDateDiv = document.getElementById('end-date');

        // Create a new Date object for a specific date (e.g., January 15, 2025)
        const endDate = new Date('2025-01-15');

        // Format the date to YYYY-MM-DD
        const y = endDate.getFullYear();
        const m = String(endDate.getMonth() + 1).padStart(2, '0');
        const d = String(endDate.getDate()).padStart(2, '0');

        const date = `${y}-${m}-${d}`;

        // Set the value of the input
        endDateDiv.value = date;
    });
}

leave_btn.addEventListener('click', async (event) => {
    let leave_type = document.getElementById("leave-type").value;

    if (leave_type == '特休') {
        leave_type = 'annual_leave';
    }
    else {
        leave_type = 'sick_leave';
    }

    let leaveData = {
        "user_id": document.getElementById("employee-id").value,
        "leave_type": leave_type,
        "start_date": document.getElementById('start-date').value,
        "end_date":  document.getElementById('end-date').value,
        "days": 7,
        "reason": "個人事務",
        "approved_by": "manager",
        "approved_at": "2025-09-21T14:30:00"
    };

    await fetch('https://0cqh75pm-5001.asse.devtunnels.ms/api/leave/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveData)
    })
    .then((res) => {
        console.log(res);
    });
});

leave_btn.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        leave_btn.click();
    }
});
