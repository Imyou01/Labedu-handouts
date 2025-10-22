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
  
  // ====== CẤU HÌNH (FIX) ======
  // Thu nhỏ để vừa khung 1060px (1100 - 40 padding)
  // Tỷ lệ gốc: 1130 / 800 = 1.4125
  const pdfUrl = new URL("./handouts/webinstruction.pdf", location.href).toString();
  const baseWidth = 520;  // FIX: (520 * 2 = 1040px, vừa vặn < 1060px)
  const baseHeight = 735; // FIX: (520 * 1.4125 = 734.5)

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
      const img = await renderPageToImage(pdfDoc, i, 1.4); 
      images.push(img);
      await new Promise(r => requestAnimationFrame(r));
    }

    // 3) Khởi tạo Flipbook (FIX)
    pageFlip = new St.PageFlip(flipEl, {
      width: baseWidth,   // 520
      height: baseHeight, // 735
      size: "stretch",    // Giữ "stretch" để lấp đầy khung 1040x735
      
      // Cập nhật min/max cho phù hợp
      minWidth: 300,
      minHeight: 424,
      maxWidth: 1040,     // 520 * 2
      maxHeight: 1470,    // 735 * 2

      showCover: true,
      mobileScrollSupport: true,
      useMouseEvents: true,
      flippingTime: 700
    });

    // FIX: Gọi bind TRƯỚC khi load
    bindFlipEvents(); 
    pageFlip.loadFromImages(images);

    // Hiển thị lại info lần đầu (đã có trong sự kiện "init")
    // pageInfo.textContent = `Trang ${pageFlip.getCurrentPageIndex() + 1} / ${pageFlip.getPageCount()}`;

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
