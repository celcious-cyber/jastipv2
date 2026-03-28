// reports.js - Kalkulator Brangkas & Generator Laporan PWA Jastip

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    let currentOrders = [];
    let currentFilter = 'day';

    const formatRp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    // 1. ENGINE PENYARING TANGGAL (REAKTIF)
    const loadReports = async (range) => {
        const loading = document.getElementById('loadingState');
        const reportList = document.getElementById('reportList');
        loading.classList.remove('d-none');
        reportList.innerHTML = '';
        currentFilter = range;

        // Tentukan Rentang Waktu
        const now = new Date();
        let startDate = new Date();
        
        if (range === 'day') {
            startDate.setHours(0, 0, 0, 0);
        } else if (range === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (range === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
        }

        try {
            const currentStoreId = localStorage.getItem('jastip_store_id');

            // [A] Ambil Data Inventori untuk Fallback HPP (Hanya milik TOKO ini)
            const { data: invData } = await window.supabaseClient.from('inventory').select('id, hpp').eq('store_id', currentStoreId);
            const invMap = {};
            if(invData) invData.forEach(i => invMap[i.id] = i.hpp || 0);

            // [B] Ambil Data Pesanan (Hanya milik TOKO ini)
            const { data, error } = await window.supabaseClient
                .from('orders')
                .select(`*, customers (name)`)
                .eq('store_id', currentStoreId) // SEGEL
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            currentOrders = data || [];
            
            calculateMetrics(currentOrders, invMap);
            renderReportList(currentOrders);
            loading.classList.add('d-none');

        } catch (err) {
            console.error(err);
            loading.innerHTML = `<p class="text-danger">Gagal membedah database: ${err.message}</p>`;
        }
    };

    // 2. KALKULATOR FINANSIAL (Logika Jastipin.Sini)
    const calculateMetrics = (orders, invMap = {}) => {
        let totalNet = 0;
        let totalGross = 0;
        let totalPacking = 0;

        orders.forEach(o => {
            const items = o.items || [];
            let orderItemRevenue = 0;
            let orderItemProfit = 0;

            items.forEach(it => {
                const price = parseFloat(it.price) || 0;
                const qty = parseInt(it.qty) || 0;
                
                // LOGIKA CERDAS: Gunakan HPP/Cost di transaksi jika ada, jika tidak (Data Lama), ambil dari Gudang
                const hpp = parseFloat(it.hpp) || parseFloat(it.cost) || invMap[it.product_id] || 0; 

                orderItemRevenue += (price * qty);
                orderItemProfit += ((price - hpp) * qty);
            });

            const packingFee = parseFloat(o.fee_jastip) || 0;
            
            totalPacking += packingFee;
            totalGross += (orderItemRevenue + packingFee); // Laba Kotor: Jual + Packing
            totalNet += (orderItemProfit + packingFee);    // Laba Bersih: (Jual-HPP) + Packing
        });

        document.getElementById('netProfitDisplay').textContent = formatRp(totalNet);
        document.getElementById('grossProfitDisplay').textContent = formatRp(totalGross);
        document.getElementById('totalFeeDisplay').textContent = formatRp(totalPacking);
    };

    // 3. RENDER VISUAL LIST TRANSAKSI
    const renderReportList = (orders) => {
        const list = document.getElementById('reportList');
        if (orders.length === 0) {
            list.innerHTML = `<div class="col-12 text-center py-4 text-muted small">Tidak ada data transaksi di periode ini.</div>`;
            return;
        }

        orders.forEach(o => {
            const dateStr = new Date(o.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            const custName = o.customers ? o.customers.name : 'Umum';
            const card = document.createElement('div');
            card.className = 'col-12';
            card.innerHTML = `
                <div class="card border-0 shadow-sm p-3 rounded-4 bg-white fade-in">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-light rounded-3 text-center p-2" style="min-width: 50px;">
                                <span class="d-block fw-bold text-dark fs-5">${dateStr.split(' ')[0]}</span>
                                <span class="x-small text-muted text-uppercase" style="font-size:0.6rem;">${dateStr.split(' ')[1]}</span>
                            </div>
                            <div>
                                <h6 class="fw-bold m-0 text-dark">${custName}</h6>
                                <span class="badge bg-light text-muted border border-light rounded-pill x-small" style="font-size:0.65rem;">ID: #${o.order_no || '---'}</span>
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="d-block fw-bold text-terracotta">${formatRp(o.total_price || 0)}</span>
                            <span class="x-small text-muted" style="font-size:0.7rem;">Packing: ${formatRp(o.fee_jastip || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    };

    // 4. MODUL EKSPOR EXCEL (DETAILED ITEM BREAKDOWN)
    document.getElementById('exportExcel').addEventListener('click', async () => {
        if (currentOrders.length === 0) return alert("Data kosong, tidak ada yang bisa diekpor.");

        const btn = document.getElementById('exportExcel');
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ekspor...';

        const storeId = localStorage.getItem('jastip_store_id');
        let storeNameStr = 'NAMA TOKO';
        const { data: storeData } = await window.supabaseClient.from('store_settings').select('store_name').eq('store_id', storeId).maybeSingle();
        if (storeData && storeData.store_name) {
            storeNameStr = storeData.store_name;
        } else {
            try {
                const sCache = JSON.parse(localStorage.getItem('jastip_store_settings'));
                if (sCache && sCache.store_name) storeNameStr = sCache.store_name;
            } catch(e) {
                storeNameStr = localStorage.getItem('jastip_store_name') || 'NAMA TOKO';
            }
        }
        
        const todayStr = new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

        const dataRows = [];
        // Header Custom Format
        dataRows.push(["LAPORAN TRANSAKSI"]);
        dataRows.push([storeNameStr.toUpperCase()]);
        dataRows.push([`TGL: ${todayStr}`]);
        dataRows.push([]); // Empty row
        dataRows.push(["NO", "TGL", "PELANGGAN", "ITEM", "HARGA", "QTY", "FEE PACKING"]);

        let no = 1;
        let grandTotalHarga = 0;
        let grandTotalQty = 0;
        let grandTotalFee = 0;

        currentOrders.forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'});
            const cust = o.customers ? o.customers.name : '-';
            const items = o.items || [];
            
            items.forEach((it, idx) => {
                const fee = idx === 0 ? parseFloat(o.fee_jastip || 0) : 0;
                grandTotalHarga += (parseFloat(it.price || 0) * parseInt(it.qty || 0));
                grandTotalQty += parseInt(it.qty || 0);
                grandTotalFee += fee;

                dataRows.push([
                    no++,
                    date,
                    cust,
                    it.name,
                    parseFloat(it.price || 0),
                    parseInt(it.qty || 0),
                    idx === 0 ? fee : ""
                ]);
            });
        });

        // ROW TOTAL
        dataRows.push([]);
        dataRows.push(["TOTAL KESELURUHAN", null, null, null, grandTotalHarga, grandTotalQty, grandTotalFee]);
        dataRows.push([]);
        dataRows.push(["GENERATED BY JASTIP STUDIO"]);

        const ws = XLSX.utils.aoa_to_sheet(dataRows);
        
        // Gabungkan cell untuk tulisan TOTAL KESELURUHAN agar posisinya di tengah kolom NO sampai ITEM
        ws['!merges'] = [
            { s: { r: dataRows.length - 3, c: 0 }, e: { r: dataRows.length - 3, c: 3 } }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Jastip");
        XLSX.writeFile(wb, `Laporan_${currentFilter}_${new Date().getTime()}.xlsx`);
        btn.innerHTML = '<i class="bi bi-file-earmark-excel me-2"></i>Ekspor Excel';
    });

    // 5. MODUL EKSPOR PDF (SUMMARY TABLE)
    document.getElementById('exportPDF').addEventListener('click', async () => {
        if (currentOrders.length === 0) return alert("Data kosong.");
        
        const btn = document.getElementById('exportPDF');
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ekspor...';

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const storeId = localStorage.getItem('jastip_store_id');
        let storeNameStr = 'NAMA TOKO';
        const { data: storeData } = await window.supabaseClient.from('store_settings').select('store_name').eq('store_id', storeId).maybeSingle();
        if (storeData && storeData.store_name) {
            storeNameStr = storeData.store_name;
        } else {
            try {
                const sCache = JSON.parse(localStorage.getItem('jastip_store_settings'));
                if (sCache && sCache.store_name) storeNameStr = sCache.store_name;
            } catch(e) {
                storeNameStr = localStorage.getItem('jastip_store_name') || 'NAMA TOKO';
            }
        }
        const todayStr = new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("LAPORAN TRANSAKSI", 14, 20);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.text(storeNameStr.toUpperCase(), 14, 28);
        
        doc.setFontSize(11);
        doc.text(`TGL: ${todayStr}`, 14, 36);

        const tableData = [];
        let no = 1;
        
        let grandTotalHarga = 0;
        let grandTotalQty = 0;
        let grandTotalFee = 0;

        currentOrders.forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'});
            const cust = o.customers ? o.customers.name : '-';
            const items = o.items || [];
            
            items.forEach((it, idx) => {
                const fee = (idx === 0) ? parseFloat(o.fee_jastip || 0) : 0;
                grandTotalHarga += (parseFloat(it.price || 0) * parseInt(it.qty || 0));
                grandTotalQty += parseInt(it.qty || 0);
                grandTotalFee += fee;

                tableData.push([
                    no++,
                    date,
                    cust,
                    it.name,
                    formatRp(parseFloat(it.price || 0)),
                    parseInt(it.qty || 0),
                    idx === 0 ? formatRp(fee) : "-"
                ]);
            });
        });

        // ROW TOTAL (Gunakan colSpan agar sel tergabung dan border rapi)
        tableData.push([
            { content: "TOTAL KESELURUHAN", colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: formatRp(grandTotalHarga), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, 
            { content: grandTotalQty, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, 
            { content: formatRp(grandTotalFee), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
        ]);

        doc.autoTable({
            startY: 45,
            head: [['NO', 'TGL', 'PELANGGAN', 'ITEM', 'HARGA', 'QTY', 'FEE PACKING']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [198, 113, 86] }, // Terracotta style
            styles: { fontSize: 9 },
            columnStyles: { 
                0: { cellWidth: 10 },
                4: { halign: 'right' },
                5: { halign: 'center' },
                6: { halign: 'right' }
            },
            didDrawPage: function(data) {
                // Footer JASTIP STUDIO
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
                
                doc.setTextColor(150, 150, 150); // Grey text for footer
                doc.setFontSize(9);
                doc.setFont("helvetica", "italic");
                doc.text("Generated by JASTIP STUDIO", pageWidth / 2, pageHeight - 10, {
                    align: "center"
                });
                doc.setTextColor(0, 0, 0); // Reset color
            }
        });

        doc.save(`Laporan_PDF_${currentFilter}.pdf`);
        btn.innerHTML = '<i class="bi bi-file-earmark-pdf me-2"></i>Ekspor PDF';
    });

    // Event Listener Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'btn-dark'));
            e.target.classList.add('active', 'btn-dark');
            loadReports(e.target.dataset.range);
        });
    });

    // Load Default (Hari Ini)
    loadReports('day');
});
