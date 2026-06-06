const socket = io();

// Request deleted history on load
socket.emit("load_deleted");

// Receive deleted history
socket.on("deleted_notifications_loaded", (data) => {
    const tbody = document.getElementById("history-body");
    tbody.innerHTML = "";

    data.forEach(item => {
        addDeletedToUI(item);
    });
});

// Real-time addition to history when a user deletes something
socket.on("notification_deleted", () => {
    // A bit hacky, but easiest way to refresh is to just reload the list
    // A better way is server sending the deleted item object
    socket.emit("load_deleted");
});

// Handle real-time removal from history when restored
socket.on("notification_restored", (deletedId) => {
    const tr = document.querySelector(`tr[data-id='${deletedId}']`);
    if (tr) {
        tr.classList.add("removing");
        setTimeout(() => tr.remove(), 300);
    }
});

function addDeletedToUI(item) {
    const tbody = document.getElementById("history-body");
    
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", item.id);
    
    tr.innerHTML = `
        <td>${item.original_id}</td>
        <td>${item.message}</td>
        <td>${new Date(item.deleted_at).toLocaleString()}</td>
        <td><button class="restore-btn" onclick="restoreNotification(${item.id}, this)">Restore</button></td>
    `;
    
    tbody.appendChild(tr);
}

window.restoreNotification = function(id, btnElement) {
    socket.emit("restore_notification", id);
    // Optimistic UI removal
    const tr = btnElement.closest("tr");
    tr.classList.add("removing");
    setTimeout(() => tr.remove(), 300);
};
