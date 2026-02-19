export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // This handles the actual site loading under a "homework" path
    if (url.pathname.startsWith("/assignments/")) {
      const encryptedUrl = url.pathname.replace("/assignments/", "");
      let targetUrl;
      
      try {
        // Decodes the "stealth" URL
        targetUrl = atob(encryptedUrl); 
      } catch (e) {
        return new Response("Assignment Not Found", { status: 404 });
      }

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: {
            "User-Agent": request.headers.get("User-Agent"),
            "Accept": request.headers.get("Accept"),
          },
          redirect: "follow"
        });

        const newHeaders = new Headers(response.headers);
        
        // Remove security headers so the site can display in your tab
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.delete("Content-Security-Policy");
        newHeaders.delete("X-Frame-Options");
        newHeaders.delete("Frame-Options");

        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
      } catch (err) {
        return new Response("Resource Error", { status: 500 });
      }
    }

    // Serve your main HTML interface
    return env.ASSETS.fetch(request);
  }
};
