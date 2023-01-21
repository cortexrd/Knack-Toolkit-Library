KnackInitAsync = function ($, callback) {
    window.ktlStart = window.performance.now();
    window.$ = $;
    window.LazyLoad = LazyLoad;
    LazyLoad.js(['https://ctrnd.com/Lib/KTL/KTL_BL.js'], function () { setCallback(callback); });
};