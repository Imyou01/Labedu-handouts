// ====== CẤU HÌNH ======
const pdfUrl = new URL("./handouts/webinstruction.pdf", location.href).toString(); // Đổi tên file nếu cần
const baseWidth = 800;   // chiều rộng mặc định mỗi trang (px) trong flipbook
const baseHeight = 1130; // gần tỉ lệ A4 (1:1.414)

// ====== BIẾN TOÀN CỤC ======
let pdfDoc = null;
let pageFlip = null;
let totalPages = 0;

const flipEl = document.getElementById("flipbook");
const pageInfo = document.getElementById("page-info");

// ====== HÀM: render 1 trang PDF -> dataURL (WebP) ======
async function renderPageToImage(pdf, num, scale = 1.4) {
  const page = await pdf.getPage(num);
  const viewport = page.getViewport({ scale });

  // Vẽ vào canvas ẩn
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Xuất ảnh WebP chất lượng 0.9
  const dataUrl = canvas.toDataURL("image/webp", 0.9);
  // Giải phóng
  canvas.width = 0; canvas.height = 0;
  return dataUrl;
}

// ====== HÀM: cập nhật hiển thị số trang ======
function bindFlipEvents() {
  pageFlip.on("init", () => {
    pageInfo.textContent = `Trang ${pageFlip.getCurrentPageIndex() + 1} / ${pageFlip.getPageCount()}`;
  });
  pageFlip.on("flip", (e) => {
    pageInfo.textContent = `Trang ${e.data + 1} / ${pageFlip.getPageCount()}`;
  });
}

// ====== KHỞI TẠO ======
(async function main() {
  try {
    pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
    totalPages = pdfDoc.numPages;

    // Render nhanh 2 trang đầu để hiển thị ngay
    const firstImages = [];
    const firstCount = Math.min(2, totalPages);
    for (let i = 1; i <= firstCount; i++) {
      firstImages.push(await renderPageToImage(pdfDoc, i, 1.4));
    }

    // Tạo flipbook
    pageFlip = new St.PageFlip(flipEl, {
      width: baseWidth,
      height: baseHeight,
      size: "stretch",
      minWidth: 400,
      minHeight: 300,
      maxWidth: 1600,
      maxHeight: 2200,
      showCover: true,
      mobileScrollSupport: true,
      useMouseEvents: true,
      flippingTime: 700
    });

    // Nạp 2 trang đầu
    pageFlip.loadFromImages(firstImages);
    bindFlipEvents();

    // Render dần các trang còn lại và add vào flipbook
    for (let i = firstCount + 1; i <= totalPages; i++) {
      const img = await renderPageToImage(pdfDoc, i, 1.4);
      pageFlip.addPage(img, i - 1); // index theo 0: trang 3 -> vị trí 2
      // Cập nhật tổng trang hiển thị
      pageInfo.textContent = `Trang ${pageFlip.getCurrentPageIndex() + 1} / ${pageFlip.getPageCount()}`;
      // Nhường thread để UI mượt
      await new Promise(r => setTimeout(r, 0));
    }
  } catch (err) {
    flipEl.innerHTML = `<div style="padding:16px;color:#b91c1c">Không tải được PDF: ${err.message}</div>`;
    console.error(err);
  }
})();

// ====== NÚT NEXT/PREV & ZOOM ======
document.getElementById("prev").addEventListener("click", () => pageFlip && pageFlip.flipPrev());
document.getElementById("next").addEventListener("click", () => pageFlip && pageFlip.flipNext());

const zoom = document.getElementById("zoom");
zoom.addEventListener("input", () => {
  const scale = parseFloat(zoom.value);
  flipEl.style.transform = `scale(${scale})`;
  flipEl.style.transformOrigin = "top center";
});
