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
// --- HÀM MỚI: Tách Tab + Tự động xóa cột rỗng ---
function loadExcelFile(url) {
  // 1. Ẩn giao diện Sách & Toolbar
  document.getElementById("flipbook").style.display = "none";
  document.querySelector(".toolbar").style.display = "none"; 

  // 2. Chuẩn bị khung chứa (Container)
  const container = document.getElementById("spreadsheet-container");
  container.style.display = "block"; 
  container.innerHTML = '<div style="text-align:center; padding:20px">Đang xử lý dữ liệu...</div>';

  fetch(url)
    .then(resp => {
        if (!resp.ok) throw new Error("Lỗi tải file");
        return resp.arrayBuffer();
    })
    .then(data => {
        // Đọc workbook
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetNames = workbook.SheetNames;

        // --- A. TẠO GIAO DIỆN TAB ---
        let tabsHtml = `<div class="excel-tabs">`;
        sheetNames.forEach((name, index) => {
            // Tab đầu tiên sẽ active mặc định
            const activeClass = index === 0 ? 'active' : '';
            tabsHtml += `<button class="tab-btn ${activeClass}" onclick="switchSheet('${name}')">${name}</button>`;
        });
        tabsHtml += `</div>`;

        // Tạo vùng chứa nội dung bảng
        tabsHtml += `<div id="excel-content-area"></div>`;
        
        // Render khung vào container
        container.innerHTML = tabsHtml;

        // Lưu workbook vào biến toàn cục (hoặc window) để dùng khi chuyển tab
        window.currentWorkbook = workbook;

        // --- B. HIỂN THỊ SHEET ĐẦU TIÊN ---
        renderSheet(sheetNames[0]);
    })
    .catch(err => {
        console.error(err);
        container.innerHTML = `<div style="color:red; padding:20px">Lỗi: ${err.message}</div>`;
    });
}

// --- HÀM PHỤ: Chuyển Tab ---
window.switchSheet = function(sheetName) {
    // 1. Cập nhật giao diện nút Tab active
    const buttons = document.querySelectorAll(".tab-btn");
    buttons.forEach(btn => {
        if(btn.innerText === sheetName) btn.classList.add("active");
        else btn.classList.remove("active");
    });

    // 2. Render nội dung sheet mới
    renderSheet(sheetName);
}

// --- HÀM PHỤ: Render và Làm sạch cột rỗng ---
function renderSheet(sheetName) {
    const workbook = window.currentWorkbook;
    const worksheet = workbook.Sheets[sheetName];
    const contentArea = document.getElementById("excel-content-area");

    // Nếu sheet không có dữ liệu
    if (!worksheet['!ref']) {
        contentArea.innerHTML = "<p>Sheet này trống.</p>";
        return;
    }

    // 1. Tạo HTML bảng từ SheetJS
    const htmlString = XLSX.utils.sheet_to_html(worksheet, { id: "current-table" });
    contentArea.innerHTML = htmlString;

    // 2. THUẬT TOÁN XOÁ CỘT RỖNG (Smart Clean)
    const table = contentArea.querySelector("table");
    if (!table) return;

    // Lấy tất cả các dòng
    const rows = table.rows;
    if (rows.length === 0) return;

    // Tính tổng số cột (dựa vào dòng đầu tiên)
    const colCount = rows[0].cells.length;
    
    // Duyệt từng cột (từ cột 0 đến hết)
    for (let colIndex = 0; colIndex < colCount; colIndex++) {
        let isColumnEmpty = true;

        // Kiểm tra dọc từ trên xuống dưới ở vị trí cột đó
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cell = rows[rowIndex].cells[colIndex];
            // Nếu tìm thấy dù chỉ 1 ô có chữ -> Cột này KHÔNG rỗng
            if (cell && cell.innerText.trim() !== "") {
                isColumnEmpty = false;
                break; // Dừng kiểm tra cột này, chuyển cột sau
            }
        }

        // Nếu sau khi quét hết mà cột vẫn rỗng -> Ẩn nó đi
        if (isColumnEmpty) {
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const cell = rows[rowIndex].cells[colIndex];
                if (cell) cell.style.display = "none"; // Ẩn ô
            }
        }
    }
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
