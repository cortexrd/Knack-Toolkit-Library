KnackInitAsync = function ($, callback) { // Load the Knack Toolkit Library (KTL)
    (window.LazyLoad = LazyLoad) && LazyLoad.js([`https://ctrnd.s3.amazonaws.com/Lib/KTL/KTL_Start.js?${new Date().valueOf()}`], () => {
        loadKtl($, callback, (typeof KnackApp === 'function' ? KnackApp : null), '' /*KTL version, leave blank to get latest*/);
    })
};
