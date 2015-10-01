import throttle from 'lodash/function/throttle';

function app (appConstructor) {
  class ClientApp extends appConstructor {
    /*
     * appConstructor: the constructor for a subclass of a Horse app
     * onLoad: an array of functions to fire on page load
     */
    constructor (config={}) {
      config.mountPoint = document.getElementById(config.mountPoint);

      super(config);

      // cache common dom refs
      this.dom = {
        $body: document.body,
        $head: document.head,
        $title: document.getElementsByTagName('title')[0],
        $mount: config.mountPoint,
      }

      // watch the first referrer so we can send it along for tracking reasons
      // if necessary
      this.referrer = document.referrer;

      // set a sane defailt for the event emitter
      this.emitter.setMaxListeners(config.maxListeners || 30);

      // for pushstate to work
      this.history = window.history || window.location.history;

      // a cache of positions to restore to
      this.scrollCache = {}

      // keep track of the landing page
      this.initialUrl = this.fullPathName();

      this.modifyContext = this.modifyContext || function (ctx) {
        return Object.assign({}, bootstrap.ctx, ctx);
      };
    }

    initialize() {
      this.render(this.initialUrl, true, this.modifyContext).then((props) => {
        this.bindScrolling();
        this.bindHistory();
      });
    }

    bindScrolling() {
      window.addEventListener('scroll', throttle(() => {
        this.emit('document:scroll');
      }, 60));
    }

    bindResize() {
      // keep track of width for resize events
      if (!this.startingWidth) {
        this.startingWidth = window.innerWidth;
      }

      if (!this.startingHeight) {
        this.startingHeight = window.innerHeight;
      }

      window.addEventListener('resize', throttle(() => {
        this.emit('document:resize');

        if (window.innerWidth !== this.startingWidth) {
          this.emit('document:resize:width');
        }

        if (window.innerWidth !== this.startingWidth) {
          this.emit('document:resize:height');
        }
      }));
    }

    bindHistory() {
      // If we have history, go ahead and bind links to app renders. It's
      // reasonable to assume that we have a decently modern browser.
      // render for the first time for mounting
      if (history) {
        this.dom.$body.addEventListener('click', (e) => {
          let $link = e.target;

          if ($link.tagName !== 'A') {
            $link = ClientApp.findLinkParent($link);
          }

          if(!$link) {
            return;
          }

          const href = $link.getAttribute('href');
          const currentUrl = this.fullPathName;

          // Don't actually follow the link unless it's internal
          if (
            ($link.target === '_blank' || $link.dataset.noRoute === 'true') ||
            href.indexOf('//') > -1
          ) {
            return;
          }

          e.preventDefault();

          // Set the current url scrollcache, for navigation changes to restore
          this.scrollCache[currentUrl] = window.scrollY;

          // Don't follow links to fragments
          if (href.indexOf('#') === 0) {
            return;
          }

          this.pushState(null, null, href);
          this.initialUrl = this.fullPathName();

          this.render(this.initialUrl, false, this.modifyContext).then((props) => {
            this.setTitle(props.title);
          });
        });

        window.addEventListener('popstate', (e) => {
          const href = this.fullPathName();
          this.scrollCache[this.initialUrl] = window.scrollY;

          this.render(href, false, this.modifyContext).then(function(props) {
            if(this.scrollCache[href]) {
              this.dom.$body.scrollTop = this.scrollCache[href];
            }

            this.setTitle(props.title);
          });

          this.initialUrl = href;
        }.bind(this));
      }
    }

    mountRoutes(routes) {
      routes(this);
    }

    pushState(data, title, url) {
      if (this.history) {
        history.pushState(data, title, url);
      }
    }

    redirect(url) {
      this.pushState(null, props.title || null, url);
      this.render(this.fullPathName(), false, this.modifyContext).then((props) => {
        this.setTitle(props.title);
      });
    }

    setTitle(title) {
      if (title) {
        if (this.dom.$title.textContent) {
          this.dom.$title.textContent = title;
        } else if (this.dom.$title.innerText) {
          this.dom.$title.innerText = title;
        }
      }
    }

    static onLoad(fns) {
      const fireNow =
        document.readyState === 'complete' || document.readyState === 'interactive';

      fns.forEach((f) => {
        if (fireNow) {
          f(this);
        } else {
          window.addEventListener('DOMContentLoaded', f());
        }
      });
    }

    static findLinkParent(el) {
      if (el.parentNode) {
        if (el.parentNode.tagName === 'A') {
          return el.parentNode;
        }

        return ClientApp.findLinkParent(el.parentNode);
      }
    }
  }

  return ClientApp;
}

export default app;
