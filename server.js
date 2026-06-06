const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mysql = require("mysql2");
const webpush = require("web-push");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 🔴 UPDATE THIS PASSWORD
const db = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 🔹 Connect to MySQL
db.connect((err) => {
    if (err) {
        console.log("❌ DB Connection Error:", err);
    } else {
        console.log("✅ MySQL Connected Successfully");
    }
});

// Serve frontend
app.use(express.static(__dirname));
app.use(express.json());

// 🔹 Web Push Setup
const publicVapidKey = "BFiqo4xjNAes99FEN20mRVyQtu5BHnhiH2kyrdlzrYuiBL6SXlth8O_XgqDoLd94iRfE_468v5ZqGB3BVpnpABc";
const privateVapidKey = "ZxZ9QpqVioKg2w2dF-9I72HbgD66Wm6T4k6Xl9AtsTY";

webpush.setVapidDetails(
    "mailto:test@example.com",
    publicVapidKey,
    privateVapidKey
);

// In-memory subscription storage (in a real app, save to DB)
let subscriptions = [];

// Subscribe Route
app.post("/subscribe", (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
    res.status(201).json({});
});

// 🔹 WebSocket connection
io.on("connection", (socket) => {
    console.log("User connected");

    // 🔹 Load old messages
    db.query("SELECT * FROM notifications ORDER BY id DESC", (err, results) => {
        if (!err) {
            socket.emit("load_notifications", results);
        } else {
            console.log(err);
        }
    });

    // 🔹 Save + send new message
    socket.on("send_notification", (msg) => {

        // Save to DB
        db.query(
            "INSERT INTO notifications (message) VALUES (?)",
            [msg],
            (err, results) => {
                if (err) return console.log(err);
                
                const newNotification = {
                    id: results.insertId,
                    message: msg,
                    priority: 'Normal' // Default
                };

                // Send to all users via WebSocket (for open tabs)
                io.emit("receive_notification", newNotification);
                
                // Send via Web Push (for closed tabs)
                const payload = JSON.stringify({ title: "New Notification", body: msg });
                
                //subscriptions.forEach(sub => {
                //   webpush.sendNotification(sub, payload).catch(err => console.error("Push Error:", err));
                //});
            }
        );
    });

    // 🔹 Delete notification
    socket.on("delete_notification", (id) => {
        // Fetch original
        db.query("SELECT * FROM notifications WHERE id = ?", [id], (err, results) => {
            if (err || results.length === 0) return;
            const notif = results[0];

            // Insert into deleted_notifications
            db.query("INSERT INTO deleted_notifications (original_id, message) VALUES (?, ?)", [notif.id, notif.message], (err) => {
                if (err) return console.log(err);
                
                // Delete from notifications
                db.query("DELETE FROM notifications WHERE id = ?", [id], (err) => {
                    if (err) return console.log(err);
                    // Broadcast deletion
                    io.emit("notification_deleted", id);
                });
            });
        });
    });

    // 🔹 Admin: Load deleted
    socket.on("load_deleted", () => {
        db.query("SELECT * FROM deleted_notifications ORDER BY deleted_at DESC", (err, results) => {
            if (!err) {
                socket.emit("deleted_notifications_loaded", results);
            }
        });
    });

    // 🔹 Admin: Restore notification
    socket.on("restore_notification", (deletedId) => {
        // Fetch from deleted
        db.query("SELECT * FROM deleted_notifications WHERE id = ?", [deletedId], (err, results) => {
            if (err || results.length === 0) return;
            const notif = results[0];

            // Insert back into notifications
            db.query("INSERT INTO notifications (id, message) VALUES (?, ?)", [notif.original_id, notif.message], (err) => {
                if (err) {
                    // if duplicate ID, just insert without ID
                    db.query("INSERT INTO notifications (message) VALUES (?)", [notif.message], (err2, res2) => {
                        if (!err2) completeRestore(deletedId, res2.insertId, notif.message);
                    });
                } else {
                    completeRestore(deletedId, notif.original_id, notif.message);
                }
            });
        });

        function completeRestore(delId, newId, msg) {
            db.query("DELETE FROM deleted_notifications WHERE id = ?", [delId], () => {
                const newNotification = { id: newId, message: msg, priority: 'Normal' };
                io.emit("receive_notification", newNotification);
                io.emit("notification_restored", delId); // tell admin panel to remove it
            });
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

app.get("/stats", (req, res) => {

    db.query(
        `
        SELECT
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM notifications) AS totalNotifications,
        (SELECT COUNT(*) FROM deleted_notifications) AS totalDeleted
        `,
        (err, results) => {

            if(err){
                return res.status(500).json(err);
            }

            res.json(results[0]);

        }
    );

});
// Start server
server.listen(3000, () => {
    console.log("🚀 Server running at http://localhost:3000");
});