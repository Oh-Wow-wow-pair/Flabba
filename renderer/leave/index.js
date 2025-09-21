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
