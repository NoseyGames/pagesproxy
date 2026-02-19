export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
          method: request.method,
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
          
          // Injected script to intercept clicks and keep them in the homework path
          const scriptInject = `
            <script>
              document.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', e => {
                  const href = link.getAttribute('href');
                  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
                  e.preventDefault();
                  const target = new URL(href, window.location.href).href;
                  window.location.href = window.location.origin + '/assignments/' + btoa(target);
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

    return env.ASSETS.fetch(request);
  }
};
