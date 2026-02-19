export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/assignments/")) {
      const encryptedUrl = url.pathname.replace("/assignments/", "");
      let targetUrl;
      
      try {
        targetUrl = atob(decodeURIComponent(encryptedUrl)); 
      } catch (e) {
        return new Response("Assignment Not Found", { status: 404 });
      }

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
          redirect: "follow"
        });

        const contentType = response.headers.get("content-type") || "";
        const newHeaders = new Headers(response.headers);
        
        newHeaders.set("Access-Control-Allow-Origin", "*");
        newHeaders.delete("Content-Security-Policy");
        newHeaders.delete("X-Frame-Options");

        if (contentType.includes("text/html")) {
          let html = await response.text();
          
          // INJECTED LOGIC: Resolves relative links (like /login) to absolute ones
          const scriptInject = `
            <script>
              const proxyPath = window.location.origin + '/assignments/';
              const targetBase = "${targetUrl}";

              document.addEventListener('click', e => {
                const origin = e.target.closest('a');
                if (origin && origin.href) {
                  e.preventDefault();
                  // This resolves the link relative to the current proxied page
                  const fullUrl = new URL(origin.getAttribute('href'), window.location.href).href;
                  
                  // If the link was intercepted or went to root, this forces it back into the proxy
                  if (!fullUrl.startsWith(proxyPath)) {
                     window.location.href = proxyPath + btoa(fullUrl);
                  } else {
                     window.location.href = fullUrl;
                  }
                }
              });

              // Intercept Forms (Login buttons, Search bars)
              document.addEventListener('submit', e => {
                const form = e.target;
                if (form.action) {
                  e.preventDefault();
                  const fullAction = new URL(form.getAttribute('action'), window.location.href).href;
                  
                  if (form.method.toUpperCase() === 'GET') {
                    const params = new URLSearchParams(new FormData(form)).toString();
                    window.location.href = proxyPath + btoa(fullAction + '?' + params);
                  } else {
                    // Note: POST requests are harder to proxy purely via URL
                    window.location.href = proxyPath + btoa(fullAction);
                  }
                }
              });
            </script>
          `;
          html = html.replace('</body>', scriptInject + '</body>');

          return new Response(html, { status: response.status, headers: newHeaders });
        }

        return new Response(response.body, { status: response.status, headers: newHeaders });
      } catch (err) {
        return new Response("Resource Unavailable", { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
