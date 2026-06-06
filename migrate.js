const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "usn22@bhumi29",
    database: "notification_db",
    multipleStatements: true
});

db.connect((err) => {
    if (err) throw err;
    console.log("Connected to database.");

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS deleted_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            original_id INT NOT NULL,
            message TEXT NOT NULL,
            deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    db.query(createTableQuery, (err) => {
        if (err) throw err;
        
        db.query("ALTER TABLE notifications ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", (err) => {
            if (err && err.errno !== 1060) throw err; // 1060 is duplicate column
            
            db.query("ALTER TABLE notifications ADD COLUMN priority VARCHAR(50) DEFAULT 'Normal'", (err) => {
                if (err && err.errno !== 1060) throw err;
                
                console.log("Migration completed successfully.");
                db.end();
            });
        });
    });
});
