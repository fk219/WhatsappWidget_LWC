export function loadScript(component, resourceUrl) {
    return new Promise((resolve, reject) => {
        // In local sandbox, we'll just load the socket.io script from cdn
        const script = document.createElement('script');
        // If the URL is '/resource/socketIo/socket.io.js', fetch it directly
        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
