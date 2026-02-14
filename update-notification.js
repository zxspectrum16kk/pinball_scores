// update-notification.js
// Handles service worker update notifications

let updateNotificationShown = false;

// Check for service worker updates
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((registration) => {
        console.log('[Update Check] Service Worker registered');

        // Check for updates periodically (every 60 seconds)
        setInterval(() => {
            registration.update();
        }, 60000);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[Update Check] New service worker found');

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available
                    console.log('[Update Check] New version available');
                    showUpdateNotification();
                }
            });
        });

        // Handle controller change (when new SW takes over)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[Update Check] Controller changed, reloading page');
            window.location.reload();
        });
    });
}

function showUpdateNotification() {
    if (updateNotificationShown) return;
    updateNotificationShown = true;

    // Create notification banner
    const banner = document.createElement('div');
    banner.id = 'update-notification';
    banner.className = 'update-notification';
    banner.innerHTML = `
        <div class="update-notification-content">
            <span class="update-icon">🔄</span>
            <span class="update-message">New version available!</span>
            <button class="update-btn primary" id="update-btn">Update Now</button>
            <button class="update-dismiss" id="dismiss-btn">Later</button>
        </div>
    `;

    document.body.appendChild(banner);

    // Animate in
    setTimeout(() => banner.classList.add('show'), 100);

    // Handle update button
    document.getElementById('update-btn').addEventListener('click', () => {
        // Tell the service worker to skip waiting
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 300);
    });

    // Handle dismiss button
    document.getElementById('dismiss-btn').addEventListener('click', () => {
        banner.classList.remove('show');
        setTimeout(() => {
            banner.remove();
            updateNotificationShown = false; // Allow showing again later
        }, 300);
    });
}
