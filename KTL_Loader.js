KnackInitAsync = function ($, callback) { // Load the Knack Toolkit Library (KTL)
    (window.LazyLoad = LazyLoad) && LazyLoad.js(['https://ctrnd.com/Lib/KTL/KTL_Start.js'], () => {
        loadKtl($, callback, KnackApp, '' /*KTL version, leave blank to get latest*/, ''/*Set to "full" for non-minified code*/);
    })
};
