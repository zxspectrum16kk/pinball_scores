// offline-indicator.js
// Displays offline status indicator and handles connection state

(function () {
    'use strict';

    // Create offline indicator element
    const indicator = document.createElement('div');
    indicator.className = 'offline-indicator';
    indicator.innerHTML = 'Offline - Viewing cached data';
    document.body.appendChild(indicator);

    // Update indicator based on connection status
    function updateConnectionStatus() {
        if (!navigator.onLine) {
            indicator.classList.add('show');
            console.log('[Offline Indicator] You are offline');
        } else {
            indicator.classList.remove('show');
            console.log('[Offline Indicator] You are online');
        }
    }

    // Listen for online/offline events
    window.addEventListener('online', () => {
        updateConnectionStatus();
        console.log('[Offline Indicator] Connection restored');
    });

    window.addEventListener('offline', () => {
        updateConnectionStatus();
        console.log('[Offline Indicator] Connection lost');
    });

    // Check initial status
    updateConnectionStatus();
})();
