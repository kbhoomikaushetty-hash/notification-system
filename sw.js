self.addEventListener("push", e => {
    const data = e.data.json();
    console.log("Push Received...", data);
    
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: "https://cdn-icons-png.flaticon.com/512/1827/1827370.png"
    });
});
