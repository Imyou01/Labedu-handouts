document.addEventListener("DOMContentLoaded", () => {
  // === 1. KIỂM TRA THƯ VIỆN ===
  if (!window.pdfjsLib || !window.St || !window.St.PageFlip) {
    document.getElementById("flipbook").innerHTML = 
      '<div style="color:red;padding:20px">Lỗi: Thiếu thư viện.</div>';
    return;
  }

  // === 2. CẤU HÌNH ===
  // Giảm scale xuống 1.2 hoặc 1.0 nếu muốn nhanh hơn nữa (nhưng mờ hơn)
  const RENDER_SCALE = 1.0; 
  const baseWidth = 520;  
  const baseHeight = 735; 

  let currentFlipBook = null;
  let flipEl = document.getElementById("flipbook");
  const pageInfo = document.getElementById("page-info");
  
  // === 3. HÀM TẢI SÁCH (LOGIC MỚI) ===
  async function loadBook(url) {
    // A. Dọn dẹp sách cũ
    if (currentFlipBook) {
      currentFlipBook.destroy();
      currentFlipBook = null;
    }

    // B. FIX LỖI: Tái tạo thẻ div an toàn (Safe Reset)
    const mainContainer = document.querySelector("main"); // Lấy thẻ cha cố định
    
    // Tạo thẻ div mới tinh
    const newFlipEl = document.createElement("div");
    newFlipEl.id = "flipbook";
    // Áp dụng lại style trong suốt (quan trọng để không bị khung trắng)
    newFlipEl.style.cssText = "background: transparent !important; box-shadow: none !important;";

    // LOGIC AN TOÀN:
    if (flipEl && flipEl.parentNode) {
      // Trường hợp 1: Thẻ cũ vẫn còn cha -> Thay thế bình thường
      flipEl.parentNode.replaceChild(newFlipEl, flipEl);
    } else {
      // Trường hợp 2: Thẻ cũ đã bị thư viện xóa mất cha -> Gắn thẻ mới vào cuối main
      if (flipEl) flipEl.remove(); // Xóa hẳn thẻ cũ đi cho sạch
      mainContainer.appendChild(newFlipEl);
    }

    // Cập nhật biến toàn cục để dùng cho lần sau
    flipEl = newFlipEl;

    pageInfo.textContent = "Đang lấy thông tin...";
    
    try {
      // B. Tải thông tin PDF (Chỉ tải file, chưa render)
      const loadingTask = pdfjsLib.getDocument(url);
      const pdfDoc = await loadingTask.promise;
      const totalPages = pdfDoc.numPages;

      // C. TẠO KHUNG HTML TRƯỚC (Đây là bước giúp nhanh hơn)
      // Tạo sẵn N thẻ div trắng tương ứng với N trang
      for (let i = 1; i <= totalPages; i++) {
        // 1. Tạo trang nội dung PDF
        const pageDiv = document.createElement("div");
        pageDiv.className = "page";
        pageDiv.id = `page-${i}`;
        pageDiv.innerHTML = `<div class="page-loader">Đang tải trang ${i}...</div>`;
        flipEl.appendChild(pageDiv);

        // --- FIX QUAN TRỌNG: CHÈN TRANG TRẮNG SAU BÌA ---
        // Nếu đây là Trang 1 (Bìa), chèn thêm 1 trang trắng ngay sau nó
        // Để khi lật bìa ra, mặt sau sẽ trắng đẹp, và nội dung bắt đầu từ trang bên phải
        if (i === 1) {
          const blankDiv = document.createElement("div");
          blankDiv.className = "page page-blank"; // Class riêng cho trang trắng
          blankDiv.innerHTML = ""; // Không có nội dung
          flipEl.appendChild(blankDiv);
        }
      }

      // D. KHỞI TẠO FLIPBOOK NGAY LẬP TỨC
      // Người dùng sẽ thấy sách ngay, dù nội dung đang trắng
      currentFlipBook = new St.PageFlip(flipEl, {
        width: baseWidth,
        height: baseHeight,
        size: "stretch",
        minWidth: 300,
        minHeight: 424,
        maxWidth: 1040,
        maxHeight: 1470,
        showCover: true,
        useMouseEvents: true,
        // Chú ý: Dùng mode HTML thì không cần flippingTime quá lâu
        flippingTime: 600 
      });

      // Load các thẻ .page vừa tạo vào Flipbook
      const pageNodes = newFlipEl.querySelectorAll(".page");
      currentFlipBook.loadFromHTML(pageNodes);

      // E. Cập nhật thông tin trang
      pageInfo.textContent = `Trang 1 / ${totalPages}`;
      currentFlipBook.on("flip", (e) => {
        pageInfo.textContent = `Trang ${e.data + 1} / ${totalPages}`;
      });

      // F. RENDER TỪNG TRANG (CHẠY NGẦM)
      // Chúng ta sẽ render từng trang và nhét Canvas vào thẻ div đã tạo
      for (let i = 1; i <= totalPages; i++) {
        renderPageDirectly(pdfDoc, i);
        
        // Mẹo: Nghỉ 1 chút sau mỗi 3 trang để trình duyệt không bị đơ
        if (i % 3 === 0) await new Promise(r => setTimeout(r, 10));
      }

    } catch (err) {
      console.error(err);
      flipEl.innerHTML = `<div style="color:red;padding:20px">Lỗi tải PDF: ${err.message}</div>`;
    }
  }

  // === 4. HÀM RENDER CANVAS TRỰC TIẾP ===
  async function renderPageDirectly(pdfDoc, pageNum) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      
      // Tính toán viewport
      // (Mẹo: Tính scale dựa trên kích thước div để nét nhất)
      const unscaledViewport = page.getViewport({ scale: 1 });
      // Tự động chỉnh scale sao cho vừa khít chiều rộng cấu hình (baseWidth)
      // Giúp ảnh nét mà không cần render quá to
      const scale = (baseWidth / unscaledViewport.width) * 1.5; // *1.5 để nét hơn trên màn retina
      
      const viewport = page.getViewport({ scale: scale });

      // Tạo Canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render PDF lên Canvas
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Tìm thẻ div trang tương ứng và thay thế nội dung loading bằng canvas
      const pageDiv = document.getElementById(`page-${pageNum}`);
      if (pageDiv) {
        pageDiv.innerHTML = ""; // Xóa chữ "Loading..."
        pageDiv.appendChild(canvas);
      }
    } catch (e) {
      console.error(`Lỗi render trang ${pageNum}:`, e);
    }
  }
// --- HÀM MỚI: Tải và hiển thị Excel ---
function loadExcelFile(url) {
  // 1. Ẩn giao diện Sách & Toolbar
  document.getElementById("flipbook").style.display = "none";
  document.querySelector(".toolbar").style.display = "none"; 

  // 2. Hiện khung Excel
  const sheetContainer = document.getElementById("spreadsheet-container");
  sheetContainer.style.display = "block"; 
  sheetContainer.innerHTML = ""; // Xóa dữ liệu cũ

  // 3. Tải file
  // Lưu ý: Cần chắc chắn bạn đã nhúng thư viện LuckyExcel và Luckysheet ở index.html
  LuckyExcel.transformExcelToLuckyByUrl(
      url, 
      "", 
      (exportJson) => {
          if (!exportJson.sheets || exportJson.sheets.length === 0) {
              alert("File Excel rỗng hoặc lỗi!");
              return;
          }
          
          luckysheet.create({
              container: 'spreadsheet-container', 
              data: exportJson.sheets, 
              title: exportJson.info.name,
              lang: 'vi',
              showinfobar: false, 
          });
      },
      (err) => {
          console.error("Lỗi tải Excel:", err);
          alert("Không tải được file Excel. Kiểm tra lại đường dẫn!");
      }
  );
}
// === 5. XỬ LÝ MENU BÊN PHẢI (LOGIC MỚI: PDF + EXCEL) ===
  const navItems = document.querySelectorAll(".nav-item");
  
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      // 1. Xử lý giao diện nút bấm (Active)
      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");

      // 2. Lấy thông tin từ HTML
      const url = item.getAttribute("data-url");
      const type = item.getAttribute("data-type"); // Lấy loại file (pdf hoặc excel)

      // 3. Kiểm tra loại file để gọi hàm tương ứng
      if (type === "excel") {
        // --- NẾU LÀ EXCEL ---
        loadExcelFile(url);
      } else {
        // --- NẾU LÀ PDF (Mặc định) ---
        // Phải ẩn Excel đi và hiện lại Sách
        document.getElementById("spreadsheet-container").style.display = "none";
        document.getElementById("flipbook").style.display = "block"; // Hoặc flex
        document.querySelector(".toolbar").style.display = "flex"; 
        
        // Gọi hàm tải sách cũ
        if(url) loadBook(url);
      }
    });
  });

  // === 6. NÚT ĐIỀU KHIỂN (Giữ nguyên) ===
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

  // Chạy lần đầu
  const defaultItem = document.querySelector(".nav-item.active");
  if(defaultItem) loadBook(defaultItem.getAttribute("data-url"));
});
