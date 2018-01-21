const jsfeat = require("jsfeat");
const dat = require("dat-gui");
const _ = require("lodash");
const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const canvas2 = document.getElementById("canvas2");
const context = canvas.getContext("2d");
const context2 = canvas2.getContext("2d");
const height = canvas.height;
const width = canvas.width;
const image = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
const contourTimeout = 100;
const maxArea = width * height;
const options = {
    blur_radius: 2,
    low_threshold: 20,
    high_threshold: 50,
};

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia || navigator.msGetUserMedia;

const onerror = function (error) {
    console.error(error);
};

const setupGUI = () => {
    const gui = new dat.GUI();

    gui.add(options, "blur_radius", 0, 4).step(1);
    gui.add(options, "low_threshold", 1, 127).step(1);
    gui.add(options, "high_threshold", 1, 127).step(1);
}

const drawPoly = (context, points) => {
    points = _.compact(points)

    if (!points.length) {
        return;
    }

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length; i++) {
        context.lineTo(points[i].x, points[i].y);
    }

    context.closePath();
    context.strokeStyle = "#ff0000";
    context.lineWidth = 4;
    context.stroke();
}

let maxContour;

const contourFinderWorker = new Worker("js/contour-worker2.js");
contourFinderWorker.addEventListener("message", function (e) {
    console.log("received contours", e.data)
    //maxContour = approxToTetragon(e.data);
    context2.clearRect(0, 0, width, height)
    e.data.forEach((c, i) => {
        context2.beginPath()
        context2.strokeStyle = 'hsl('+~~(Math.random()*360)+', 50%, 50%)'
        c.forEach(function(p){{
            context2.lineTo(p % width, Math.floor(p/width))
        }})
        context2.stroke()
    })

});

/*
const contourFinderWorker = new Worker("js/contour-worker.js");
contourFinderWorker.addEventListener("message", function (e) {
    console.log("received contours", e.data)
    maxContour = approxToTetragon(e.data);
});*/

const approxToTetragon = (points) => {
    const lt = _.sortBy(points, p => Math.pow(p.x, 2) + Math.pow(p.y, 2))[0];
    const rt = _.sortBy(points, p => Math.pow(width - p.x, 2) + Math.pow(p.y, 2))[0];
    const lb = _.sortBy(points, p => Math.pow(p.x, 2) + Math.pow(height - p.y, 2))[0];
    const rb = _.sortBy(points, p => Math.pow(width - p.x, 2) + Math.pow(height - p.y, 2))[0];

    return [lt, rt, rb, lb];
};

const throttle = (fn, time) => {
    let wait = false;

    return function () {
        if (!wait) {
            setTimeout(function () {
                wait = false;
            }, time);

            fn.apply(null, arguments);
            wait = true;
        }
    };
};
const throttledContourFind = throttle((imageData) => contourFinderWorker.postMessage(imageData), 2000);

const tick = () => {
    requestAnimationFrame(tick);

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        context.drawImage(video, 0, 0, 640, 480);

        const imageData = context.getImageData(0, 0, 640, 480);
        jsfeat.imgproc.grayscale(imageData.data, 640, 480, image);

        const r = options.blur_radius|0;
        const kernel_size = (r+1) << 1;

        jsfeat.imgproc.gaussian_blur(image, image, kernel_size, 0);
        jsfeat.imgproc.canny(image, image, options.low_threshold|0, options.high_threshold|0);

        // render result back to canvas
        let data_u32 = new Uint32Array(imageData.data.buffer);
        const alpha = (0xff << 24);
        let i = image.cols*image.rows, pix = 0;

        while(--i >= 0) {
            pix = image.data[i];
            data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
        }
        context.putImageData(imageData, 0, 0);
        drawPoly(context, maxContour);
        throttledContourFind(imageData);
    }
}

if (!!navigator.getUserMedia) {
    setupGUI();

    navigator.getUserMedia({ video: true }, function (localMediaStream) {
        video.src = window.URL.createObjectURL(localMediaStream);

        requestAnimationFrame(tick);
    }, onerror);
} else {
    alert("getUserMedia is not supported in your browser");
}
