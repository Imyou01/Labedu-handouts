// Đường dẫn tới file PDF của bạn
const url = "handouts/webinstruction.pdf";

let pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1.3,
    canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");

document.getElementById("viewer").appendChild(canvas);

// Load PDF
pdfjsLib.getDocument(url).promise.then(function (pdf) {
  pdfDoc = pdf;
  document.getElementById("page-info").textContent =
    `Trang ${pageNum} / ${pdfDoc.numPages}`;
  renderPage(pageNum);
});

// Render 1 trang
function renderPage(num) {
  pageRendering = true;
  pdfDoc.getPage(num).then(function (page) {
    const viewport = page.getViewport({ scale: scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = { canvasContext: ctx, viewport: viewport };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function () {
      pageRendering = false;
      document.getElementById("page-info").textContent =
        `Trang ${pageNum} / ${pdfDoc.numPages}`;
      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
  });
}

// Điều hướng
function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

document.getElementById("prev").addEventListener("click", function () {
  if (pageNum <= 1) return;
  pageNum--;
  queueRenderPage(pageNum);
});

document.getElementById("next").addEventListener("click", function () {
  if (pageNum >= pdfDoc.numPages) return;
  pageNum++;
  queueRenderPage(pageNum);
});
