export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Handle Proxy Requests
    if (url.pathname.startsWith("/classwork/")) {
      const encryptedUrl = url.pathname.replace("/proxy/", "");
      let targetUrl;
      
      try {
        targetUrl = atob(encryptedUrl); // Decrypt Base64
      } catch (e) {
        return new Response("Invalid URL", { status: 400 });
      }

      try {
        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent": request.headers.get("User-Agent"),
            "Accept": request.headers.get("Accept"),
          },
          redirect: "follow"
        });

        // Create a new response so we can modify headers
        const newHeaders = new Headers(response.headers);
        
        // CRITICAL: Strip security headers so it works in an iframe
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.delete("Content-Security-Policy");
        newHeaders.delete("X-Frame-Options");
        newHeaders.delete("Frame-Options");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (err) {
        return new Response("Fetch Error: " + err.message, { status: 500 });
      }
    }

    // 2. Otherwise, serve your HTML file
    return env.ASSETS.fetch(request);
  }
};
