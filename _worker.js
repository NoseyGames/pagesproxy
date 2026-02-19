export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/assignments/")) {
      const encryptedUrl = url.pathname.replace("/assignments/", "");
      let targetUrl;
      
      try {
        // Use decodeURIComponent to handle special characters in the Base64 string
        targetUrl = atob(decodeURIComponent(encryptedUrl)); 
      } catch (e) {
        return new Response("Invalid Assignment Link", { status: 400 });
      }

      try {
        // Request the site with a clean set of headers
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow"
        });

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        
        // Remove ALL headers that block iframes
        newHeaders.delete("Content-Security-Policy");
        newHeaders.delete("X-Frame-Options");
        newHeaders.delete("Frame-Options");
        newHeaders.delete("X-Content-Type-Options");

        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
      } catch (err) {
        return new Response("Could not connect to resource.", { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
