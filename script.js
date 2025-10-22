document.addEventListener("DOMContentLoaded", () => {
   // BẮT BUỘC: kiểm tra thư viện đã nạp
  if (!window.pdfjsLib) {
    console.error("PDF.js chưa nạp");
    document.getElementById("flipbook").innerHTML =
      '<div style="padding:16px;color:#b91c1c">Không tải được PDF.js</div>';
    return;
  }
  if (!window.St || !window.St.PageFlip) {
    console.error("StPageFlip chưa nạp");
    document.getElementById("flipbook").innerHTML =
      '<div style="padding:16px;color:#b91c1c">Không tải được StPageFlip</div>';
    return;
  }
  // ====== CẤU HÌNH ======
  const pdfUrl = new URL("./handouts/webinstruction.pdf", location.href).toString();
  const baseWidth = 540;
  const baseHeight = 763;

  let pdfDoc = null;
  let pageFlip = null;
  let totalPages = 0;

  const flipEl = document.getElementById("flipbook");
  const pageInfo = document.getElementById("page-info");

  async function renderPageToImage(pdf, num, scale = 1.4) {
    const page = await pdf.getPage(num);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/webp", 0.9);
  }

  function bindFlipEvents() {
    pageFlip.on("init", () => {
      pageInfo.textContent =
        `Trang ${pageFlip.getCurrentPageIndex() + 1} / ${pageFlip.getPageCount()}`;
    });
    pageFlip.on("flip", (e) => {
      pageInfo.textContent =
        `Trang ${e.data + 1} / ${pageFlip.getPageCount()}`;
    });
  }

  (async function main() {
  try {
    // 1) Tải PDF
    pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
    totalPages = pdfDoc.numPages;

    // 2) Render toàn bộ trang -> array ảnh (có progress)
    const images = [];
    for (let i = 1; i <= totalPages; i++) {
      pageInfo.textContent = `Đang chuẩn bị: ${i}/${totalPages}`;
      const img = await renderPageToImage(pdfDoc, i, 1.4); // scale 1.2–1.4 là đẹp
      images.push(img);
      // Nhường UI 1 khung hình cho mượt
      await new Promise(r => requestAnimationFrame(r));
    }

    // 3) Khởi tạo Flipbook 1 lần rồi nạp toàn bộ ảnh
    pageFlip = new St.PageFlip(flipEl, {
      width: baseWidth,
      height: baseHeight,
     // size: "stretch",
      minWidth: 400,
      minHeight: 300,
      maxWidth: 1600,
      maxHeight: 2200,
      showCover: true,
      mobileScrollSupport: true,
      useMouseEvents: true,
      flippingTime: 700
    });

  
      bindFlipEvents(); // cập nhật số trang / lật trang
    pageFlip.loadFromImages(images);

    // Hiển thị lại info lần đầu
    pageInfo.textContent = `Trang ${pageFlip.getCurrentPageIndex() + 1} / ${pageFlip.getPageCount()}`;

  } catch (err) {
    flipEl.innerHTML =
      `<div style="padding:16px;color:#b91c1c">Không tải được PDF: ${err.message}</div>`;
    console.error(err);
  }
})();


  document.getElementById("prev").addEventListener("click", () => pageFlip && pageFlip.flipPrev());
  document.getElementById("next").addEventListener("click", () => pageFlip && pageFlip.flipNext());
  document.getElementById("zoom").addEventListener("input", (e) => {
    const scale = parseFloat(e.target.value);
    flipEl.style.transform = `scale(${scale})`;
    flipEl.style.transformOrigin = "top center";
  });
});


