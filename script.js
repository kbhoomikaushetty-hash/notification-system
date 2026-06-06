const socket = io();

// Request notification permission on load
if ("Notification" in window && Notification.permission !== "denied") {
    Notification.requestPermission();
}

const publicVapidKey = "BFiqo4xjNAes99FEN20mRVyQtu5BHnhiH2kyrdlzrYuiBL6SXlth8O_XgqDoLd94iRfE_468v5ZqGB3BVpnpABc";

// Register Service Worker and Push
//if ("serviceWorker" in navigator) {
 //   setupPush().catch(err => console.error("Service Worker Error:", err));
//}

async function setupPush() {
    // Register Service Worker
    const register = await navigator.serviceWorker.register("/sw.js", {
        scope: "/"
    });

    // Register Push Subscription
    const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });

    // Send Subscription to Server
    await fetch("/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription),
        headers: {
            "content-type": "application/json"
        }
    });
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

let unreadCount = 0;

// Clear badge when the user views the tab
window.addEventListener('focus', () => {
    unreadCount = 0;
    if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge();
    }
});

function showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>🔔 ${message}</span>`;
    
    container.appendChild(toast);

    // Remove toast after animation completes (3 seconds)
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

function showBrowserNotification(message) {

    if (
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        const notification =
        new Notification(
            "🔔 New Notification",
            {
                body: message
            }
        );

        notification.onclick = function () {

            window.focus();

            window.location.href =
            "notifications.html";

            notification.close();
        };

    }
}

function sendNotification() {
    const msg = document.getElementById("msg").value;

    if (msg.trim() === "") return;

    socket.emit("send_notification", msg);

    document.getElementById("msg").value = "";
}

// Load old messages
socket.on("load_notifications", (data) => {
    const list = document.getElementById("notifications");
    list.innerHTML = "";

    // data is DESC (newest first). Reverse it so prepending puts newest at the top
    data.reverse().forEach((item) => {
        addNotificationToUI(item);
    });
});

// New messages
socket.on("receive_notification", (notif) => {
    addNotificationToUI(notif);
    
    // Trigger Alerts
    showToast(notif.message);
    showBrowserNotification(notif.message);

    // Update Taskbar Badge
    if (document.hidden && 'setAppBadge' in navigator) {
        unreadCount++;
        navigator.setAppBadge(unreadCount);
    }
});

// Handle deletion sync
socket.on("notification_deleted", (id) => {
    const li = document.querySelector(`li[data-id='${id}']`);
    if (li) {
        li.classList.add("removing");
        setTimeout(() => li.remove(), 300);
    }
});

function addNotificationToUI(notif) {
    const list = document.getElementById("notifications");
    
    const li = document.createElement("li");
    li.setAttribute("data-id", notif.id);
    
    const textSpan = document.createElement("span");
    textSpan.textContent = notif.message;
    
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "Delete";
    delBtn.onclick = () => {
        socket.emit("delete_notification", notif.id);
        // Optimistically remove from UI
        li.classList.add("removing");
        setTimeout(() => li.remove(), 300);
    };

    li.appendChild(textSpan);
    li.appendChild(delBtn);
    list.prepend(li);
}