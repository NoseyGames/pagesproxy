export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- 1. HANDLE PROXY TRAFFIC ---
    // Pattern: /assignments/<base64_origin>/<path>
    if (url.pathname.startsWith("/assignments/")) {
      // Extract the messy part of the URL
      const pathParts = url.pathname.split('/');
      // parts[0] is empty, parts[1] is 'assignments', parts[2] is the encoded domain
      const encodedOrigin = pathParts[2];
      const remainderPath = '/' + pathParts.slice(3).join('/'); // The rest of the path

      let targetOrigin;
      try {
        targetOrigin = atob(decodeURIComponent(encodedOrigin));
        // Ensure origin doesn't have a trailing slash for clean concatenation
        if (targetOrigin.endsWith('/')) targetOrigin = targetOrigin.slice(0, -1);
      } catch (e) {
        return new Response("Invalid Assignment Data", { status: 400 });
      }

      // Construct the actual URL to fetch
      const targetUrl = targetOrigin + remainderPath + url.search;

      // Prepare request headers (forward cookies, User-Agent, etc.)
      const newHeaders = new Headers(request.headers);
      newHeaders.set("Host", new URL(targetOrigin).host);
      newHeaders.set("Referer", targetOrigin + "/");
      // Spoof the User-Agent to look like a normal Chrome user on Windows
      newHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: newHeaders,
          body: request.body,
          redirect: "manual" // We handle redirects manually to rewrite them
        });

        // Handle Redirects (301, 302) from the target
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("Location");
          if (location) {
            // Rewrite the redirect location to stay inside the proxy
            const newLocation = resolveUrl(location, targetOrigin);
            return Response.redirect(
              `${url.origin}/assignments/${encodeURIComponent(btoa(new URL(newLocation).origin))}${new URL(newLocation).pathname}${new URL(newLocation).search}`, 
              response.status
            );
          }
        }

        // Prepare response headers
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.delete("Content-Security-Policy");
        responseHeaders.delete("X-Frame-Options");
        responseHeaders.delete("Frame-Options");

        // If it's HTML, we MUST rewrite the links inside it
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          return new HTMLRewriter()
            .on("a", new AttributeRewriter("href", targetOrigin, url.origin))
            .on("img", new AttributeRewriter("src", targetOrigin, url.origin))
            .on("link", new AttributeRewriter("href", targetOrigin, url.origin)) // CSS
            .on("script", new AttributeRewriter("src", targetOrigin, url.origin)) // JS
            .on("form", new AttributeRewriter("action", targetOrigin, url.origin))
            .transform(response);
        }

        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders
        });

      } catch (err) {
        // Return a cleaner error page
        return new Response(`Proxy Error: ${err.message}`, { status: 500 });
      }
    }

    // --- 2. SERVE THE UI ---
    return env.ASSETS.fetch(request);
  }
};

// --- HELPER CLASS FOR HTML REWRITER ---
class AttributeRewriter {
  constructor(attributeName, targetOrigin, proxyOrigin) {
    this.attributeName = attributeName;
    this.targetOrigin = targetOrigin;
    this.proxyOrigin = proxyOrigin;
  }

  element(element) {
    const attribute = element.getAttribute(this.attributeName);
    if (attribute) {
      const newVal = resolveUrl(attribute, this.targetOrigin);
      // Re-wrap the resolved URL into the proxy format
      // Format: /assignments/<base64_origin>/<path>
      const newOrigin = new URL(newVal).origin;
      const newPath = new URL(newVal).pathname + new URL(newVal).search;
      
      const proxyUrl = `${this.proxyOrigin}/assignments/${encodeURIComponent(btoa(newOrigin))}${newPath}`;
      element.setAttribute(this.attributeName, proxyUrl);
    }
  }
}

// Helper to turn relative paths (../style.css) into absolute ones (https://site.com/style.css)
function resolveUrl(url, base) {
  try {
    if (url.startsWith('http')) return url;
    return new URL(url, base).href;
  } catch (e) {
    return url;
  }
}
