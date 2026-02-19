export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Handle Proxy Requests
    if (url.pathname.startsWith("/assignments/")) {
      const encryptedUrl = url.pathname.replace("/assignments/", "");
      let targetUrl;
      
      try {
        targetUrl = atob(encryptedUrl); 
      } catch (e) {
        return new Response("Assignment Not Found", { status: 404 });
      }

      try {
        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent": request.headers.get("User-Agent"),
            "Accept": request.headers.get("Accept"),
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
          
          // Inject the link-fixer script
          const scriptInject = `
            <script>
              document.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', e => {
                  e.preventDefault();
                  try {
                    const target = new URL(link.href, window.location.origin).href;
                    if (target.startsWith('http')) {
                      window.top.location.href = window.location.origin + '/assignments/' + btoa(target);
                    }
                  } catch(err) {}
                });
              });
              
              document.querySelectorAll('form').forEach(form => {
                form.addEventListener('submit', e => {
                  e.preventDefault();
                  try {
                    const action = new URL(form.action, window.location.origin).href;
                    const method = form.method.toUpperCase();
                    if (method === 'GET') {
                      const params = new URLSearchParams(new FormData(form)).toString();
                      window.top.location.href = window.location.origin + '/assignments/' + btoa(action + '?' + params);
                    }
                  } catch(err) {}
                });
              });
            </script>
          `;
          html = html.replace('</body>', scriptInject + '</body>');

          return new Response(html, {
            status: response.status,
            headers: newHeaders
          });
        }

        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
      } catch (err) {
        return new Response("Resource Error", { status: 500 });
      }
    }

    // 2. Serve the UI (Fallback)
    // If you are using Cloudflare Pages, use: return env.ASSETS.fetch(request);
    // If you want the HTML embedded directly in the worker, use the block below:
    return new Response(HTML_CONTENT, {
      headers: { "Content-Type": "text/html" }
    });
  }
};

const HTML_CONTENT = `
`;
