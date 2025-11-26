document.addEventListener("DOMContentLoaded", () => {
  // === 1. KIỂM TRA THƯ VIỆN ===
  if (!window.pdfjsLib || !window.St || !window.St.PageFlip) {
    document.getElementById("flipbook").innerHTML = 
      '<div style="color:red;padding:20px">Lỗi: Chưa nạp đủ thư viện PDF.js hoặc PageFlip</div>';
    return;
  }

  // === 2. CẤU HÌNH (Đồng bộ với CSS) ===
  const baseWidth = 520;  
  const baseHeight = 735; 

  // Các biến toàn cục quản lý trạng thái
  let currentFlipBook = null;
  const flipEl = document.getElementById("flipbook");
  const pageInfo = document.getElementById("page-info");
  
  // === 3. HÀM XỬ LÝ PDF ===
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

  // === 4. HÀM TẢI SÁCH (CORE) ===
  async function loadBook(url) {
    // A. Dọn dẹp sách cũ (nếu có)
    if (currentFlipBook) {
      currentFlipBook.destroy(); // Hủy instance cũ
      currentFlipBook = null;
      flipEl.innerHTML = ""; // Xóa sạch HTML cũ
    }

    // Reset thông báo
    pageInfo.textContent = "Đang tải tài liệu...";
    
    try {
      // B. Tải PDF
      const loadingTask = pdfjsLib.getDocument(url);
      const pdfDoc = await loadingTask.promise;
      const totalPages = pdfDoc.numPages;
      const images = [];

      // C. Render từng trang
      for (let i = 1; i <= totalPages; i++) {
        pageInfo.textContent = `Đang xử lý trang: ${i}/${totalPages}`;
        const img = await renderPageToImage(pdfDoc, i, 1.4);
        images.push(img);
        // Nghỉ 1 chút để không đơ trình duyệt
        await new Promise(r => requestAnimationFrame(r));
      }

      // D. Khởi tạo Flipbook mới
      currentFlipBook = new St.PageFlip(flipEl, {
        width: baseWidth,
        height: baseHeight,
        size: "stretch",
        minWidth: 300,
        minHeight: 424,
        maxWidth: 1040,
        maxHeight: 1470,
        showCover: true,
        useMouseEvents: true
      });

      // E. Gán sự kiện lật trang
      currentFlipBook.on("flip", (e) => {
        pageInfo.textContent = `Trang ${e.data + 1} / ${currentFlipBook.getPageCount()}`;
      });

      // F. Nạp ảnh vào sách
      currentFlipBook.loadFromImages(images);
      
      // Cập nhật thông tin ban đầu
      pageInfo.textContent = `Trang 1 / ${currentFlipBook.getPageCount()}`;

    } catch (err) {
      console.error(err);
      flipEl.innerHTML = `<div style="color:red;padding:20px;text-align:center">
        Không thể tải tài liệu này.<br>Lỗi: ${err.message}<br>
        (Kiểm tra xem đường dẫn file PDF có đúng không)
      </div>`;
    }
  }

  // === 5. XỬ LÝ SỰ KIỆN MENU ===
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      // 1. Xử lý giao diện (Active class)
      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");

      // 2. Lấy URL và tải sách
      const url = item.getAttribute("data-url");
      if(url) {
        loadBook(url);
      }
    });
  });

  // === 6. CÁC NÚT ĐIỀU KHIỂN (Prev/Next/Zoom) ===
  document.getElementById("prev").addEventListener("click", () => {
    if (currentFlipBook) currentFlipBook.flipPrev();
  });
  
  document.getElementById("next").addEventListener("click", () => {
    if (currentFlipBook) currentFlipBook.flipNext();
  });

  document.getElementById("zoom").addEventListener("input", (e) => {
    const scale = parseFloat(e.target.value);
    flipEl.style.transform = `scale(${scale})`;
    flipEl.style.transformOrigin = "top center";
  });

  // === 7. CHẠY MẶC ĐỊNH LẦN ĐẦU ===
  // Tự động click vào mục đầu tiên (active) để tải sách
  const defaultItem = document.querySelector(".nav-item.active");
  if(defaultItem) {
    const url = defaultItem.getAttribute("data-url");
    loadBook(url);
  }
});
