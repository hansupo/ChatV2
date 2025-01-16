import { toggleDarkMode, setBackground, setGradientColor, setGradientOpacity } from './ui-utils.js';

export function initializeMenu() {
    const menuButton = document.querySelector('.right-menu-button');
    const closeButton = document.querySelector('.close-menu-button');
    const menu = document.querySelector('.right-menu');
    
    // Add notification permission button
    const notificationButton = document.createElement('button');
    notificationButton.className = 'menu-item';
    notificationButton.innerHTML = `
        <span class="menu-item-text">Notifications</span>
        <div class="menu-item-icon notification-toggle">🔔</div>
    `;

    // Insert after dark mode button
    const darkModeButton1 = menu.querySelector('.menu-item:has(.dark-mode-toggle)');
    darkModeButton1.parentNode.insertBefore(notificationButton, darkModeButton1.nextSibling);

    function closeMenu() {
        menu.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function openMenu() {
        menu.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    menuButton.addEventListener('click', openMenu);
    closeButton.addEventListener('click', closeMenu);
    
    // Initialize dark mode from localStorage
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        const darkModeIcon = menu.querySelector('.dark-mode-toggle');
        darkModeIcon.innerHTML = '☀️';
    }
    
    // Wire up dark mode toggle
    const darkModeButton = menu.querySelector('.menu-item:has(.dark-mode-toggle)');
    const darkModeIcon = darkModeButton.querySelector('.dark-mode-toggle');
    
    darkModeButton.addEventListener('click', (e) => {
        // Prevent handling if the click was on the icon (it will bubble up)
        if (e.target === darkModeIcon) {
            return;
        }
        toggleDarkMode();
        // Update button icon
        darkModeIcon.innerHTML = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
    });
    
    // Background selection handling
    const backgroundButton = menu.querySelector('.menu-item-expandable .menu-item');
    const backgroundGrid = menu.querySelector('.background-grid');
    const colorPicker = menu.querySelector('#gradient-color');
    
    // Initialize color picker from localStorage
    const savedColor = localStorage.getItem('gradientColor') || '#000000';
    colorPicker.value = savedColor;
    
    // Handle color picker changes
    colorPicker.addEventListener('change', (e) => {
        const color = e.target.value;
        localStorage.setItem('gradientColor', color);
        setGradientColor(color);
    });
    
    // Toggle background controls
    backgroundButton.addEventListener('click', () => {
        const expandableContainer = backgroundButton.closest('.menu-item-expandable');
        expandableContainer.classList.toggle('expanded');
        backgroundGrid.classList.toggle('expanded');
        if (backgroundGrid.classList.contains('expanded') && !backgroundGrid.hasChildNodes()) {
            loadBackgrounds();
        }
    });
    
    async function loadBackgrounds() {
        try {
            const response = await fetch('/api/backgrounds');
            const backgrounds = await response.json();
            
            // Clear existing backgrounds (except "No Background" option)
            const existingOptions = backgroundGrid.querySelectorAll('.background-option:not([data-bg="none"])');
            existingOptions.forEach(opt => opt.remove());
            
            // Add background options
            backgrounds.forEach(bg => {
                const option = document.createElement('div');
                option.className = 'background-option';
                option.dataset.bg = bg;
                
                const preview = document.createElement('div');
                preview.className = 'background-preview';
                
                // Try PNG first, fallback to JPG
                const img = new Image();
                img.onload = () => {
                    preview.style.backgroundImage = `url('/media/backgrounds/${bg}.png')`;
                };
                img.onerror = () => {
                    preview.style.backgroundImage = `url('/media/backgrounds/${bg}.jpg')`;
                };
                img.src = `/media/backgrounds/${bg}.png`;
                
                const label = document.createElement('span');
                label.textContent = bg.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                
                option.appendChild(preview);
                option.appendChild(label);
                backgroundGrid.appendChild(option);
            });
            
            // Update selected state
            updateSelectedBackground();
        } catch (error) {
            console.error('Failed to load backgrounds:', error);
        }
    }
    
    function updateSelectedBackground() {
        const currentBg = localStorage.getItem('currentBackground') || 'none';
        backgroundGrid.querySelectorAll('.background-preview').forEach(preview => {
            preview.classList.remove('selected');
        });
        const selectedOption = backgroundGrid.querySelector(`[data-bg="${currentBg}"] .background-preview`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }
    
    // Handle background selection
    backgroundGrid.addEventListener('click', (e) => {
        const option = e.target.closest('.background-option');
        if (option) {
            const bg = option.dataset.bg;
            setBackground(bg);
            updateSelectedBackground();
        }
    });
    
    // Wire up reload button
    const reloadButton = menu.querySelector('.menu-item:has(.reload-button)');
    reloadButton.addEventListener('click', () => window.location.reload());
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (menu.classList.contains('active') && 
            !menu.contains(e.target) && 
            !menuButton.contains(e.target)) {
            closeMenu();
        }
    });
    
    // Load initial background from localStorage
    const savedBackground = localStorage.getItem('currentBackground');
    if (savedBackground) {
        setBackground(savedBackground);
    }
    
    // Initial load of background options
    loadBackgrounds();
    
    // Initialize opacity slider from localStorage
    const opacitySlider = menu.querySelector('#gradient-opacity');
    const opacityValue = menu.querySelector('.opacity-value');
    const savedOpacity = localStorage.getItem('gradientOpacity') || '1';
    opacitySlider.value = savedOpacity * 100;
    opacityValue.textContent = `${Math.round(savedOpacity * 100)}%`;
    
    // Handle opacity slider changes
    opacitySlider.addEventListener('input', (e) => {
        const opacity = e.target.value / 100;
        opacityValue.textContent = `${e.target.value}%`;
        localStorage.setItem('gradientOpacity', opacity.toString());
        setGradientOpacity(opacity);
    });
    
    // Handle notification permission
    notificationButton.addEventListener('click', async () => {
        try {
            if (!('Notification' in window)) {
                console.log('Notifications not supported');
                return;
            }

            // Check if service worker is available
            if (!('serviceWorker' in navigator)) {
                console.log('Service Worker not supported');
                return;
            }

            // Log current permission state
            console.log('Current notification permission:', Notification.permission);

            if (Notification.permission === 'granted') {
                // Unsubscribe logic
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                    localStorage.setItem('notificationsEnabled', 'false');
                    notificationButton.querySelector('.notification-toggle').innerHTML = '🔕';
                }
            } else {
                // First request notification permission
                const permission = await Notification.requestPermission();
                console.log('Permission request result:', permission);

                if (permission === 'granted') {
                    // Get service worker registration
                    const registration = await navigator.serviceWorker.ready;
                    console.log('Service Worker ready');

                    // Get VAPID key
                    const response = await fetch('/api/vapid-public-key');
                    const { publicKey } = await response.json();
                    console.log('Got VAPID public key');

                    // Subscribe to push notifications
                    try {
                        const subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: publicKey
                        });
                        console.log('Push subscription successful:', subscription);

                        // Send subscription to server
                        const subscribeResponse = await fetch('/api/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                subscription,
                                userId: window.currentUser.id
                            })
                        });

                        if (subscribeResponse.ok) {
                            localStorage.setItem('notificationsEnabled', 'true');
                            notificationButton.querySelector('.notification-toggle').innerHTML = '🔔';
                            console.log('Subscription saved on server');
                        } else {
                            console.error('Failed to save subscription on server');
                        }
                    } catch (error) {
                        console.error('Push subscription failed:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling notifications:', error);
        }
    });

    // Initialize notification toggle state
    if (localStorage.getItem('notificationsEnabled') === 'true') {
        notificationButton.querySelector('.notification-toggle').innerHTML = '🔔';
    } else {
        notificationButton.querySelector('.notification-toggle').innerHTML = '🔕';
    }
} 