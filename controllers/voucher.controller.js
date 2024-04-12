import connectToDB from "../config/db.js";

async function getVouchers(req, res) {
    const pool = await connectToDB();
    if (!pool)
        return res
            .status(500)
            .json({
                status: 500,
                message: "Failed to connect to the database",
            });
    try {
        const [rows] = await pool.query("SELECT * FROM Vouchers");

        if (pool) await pool.end();
        return res
            .status(200)
            .json({ status: 200, message: "success", data: rows });
    } catch (error) {
        if (pool) await pool.end();

        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function getVoucher(req, res) {
    const pool = await connectToDB();
    if (!pool)
        return res
            .status(500)
            .json({
                status: 500,
                message: "Failed to connect to the database",
            });
    try {
        const voucher_id = req.params.id;
        const [rows] = await pool.query(
            `SELECT * FROM Vouchers WHERE id = '${voucher_id}'`
        );

        return res
            .status(200)
            .json({ status: 200, message: "success", data: rows[0] });
    } catch (error) {
        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function getUserVouchers(req, res) {
    const pool = await connectToDB();
    if (!pool)
        return res
            .status(500)
            .json({
                status: 500,
                message: "Failed to connect to the database",
            });
    const user_id = req.params.user_id;
    try {
        const [rows] = await pool.query(
            "SELECT * FROM Vouchers WHERE JSON_CONTAINS(applicable_users, ?)",
            [JSON.stringify(user_id)]
        );

        if (pool) await pool.end();
        return res
            .status(200)
            .json({ status: 200, message: "success", data: rows });
    } catch (error) {
        if (pool) await pool.end();

        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function createVoucher(req, res) {
    const pool = await connectToDB();
    if (!pool)
        return res
            .status(500)
            .json({
                status: 500,
                message: "Failed to connect to the database",
            });
    const {
        voucher_name,
        description,
        start_date,
        end_date,
        image,
        discount_type,
        discount_price,
        min_order_price,
        applicable_stores,
        applicable_products,
        applicable_users,
    } = req.body;

    const _applicable_stores = applicable_stores
        ? JSON.stringify(applicable_stores)
        : null;
    const _applicable_users = applicable_users
        ? JSON.stringify(applicable_users)
        : null;
    const _applicable_products = applicable_products
        ? JSON.stringify(applicable_products)
        : null;

    try {
        await pool.beginTransaction();
        const [result] = await pool.query(
            "INSERT INTO Vouchers (voucher_name, description, start_date, end_date, image, discount_type, discount_price, min_order_price, applicable_stores, applicable_products, applicable_users) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                voucher_name,
                description,
                start_date,
                end_date,
                image,
                discount_type,
                discount_price,
                min_order_price || 0,
                _applicable_stores,
                _applicable_products,
                _applicable_users,
            ]
        );

        const [rows] = await pool.query(
            `SELECT * FROM Vouchers WHERE id = '${result.insertId}'`
        );

        await pool.commit();

        return res
            .status(200)
            .json({ status: 200, message: "success", data: rows[0] });
    } catch (error) {
        await pool.rollback();

        return res.status(500).json({ status: 500, message: error.message });
    } finally {
        if (pool) await pool.end();
    }
}

async function editVoucher(req, res) {
    const pool = await connectToDB();
    if (!pool)
        return res
            .status(500)
            .json({
                status: 500,
                message: "Failed to connect to the database",
            });

    const voucher_id = req.params.id;

    const {
        voucher_name,
        description,
        start_date,
        end_date,
        image,
        discount_type,
        discount_price,
        min_order_price,
        applicable_stores,
        applicable_products,
        applicable_users,
    } = req.body;

    const _applicable_stores = JSON.stringify(applicable_stores);
    const _applicable_users = JSON.stringify(applicable_users);
    const _applicable_products = JSON.stringify(applicable_products);

    try {
        const [result] = await pool.query(
            "UPDATE Vouchers SET voucher_name = ?, description = ?, start_date = ?, end_date = ?, image = ?, discount_type = ?, discount_price = ?, min_order_price = ?, applicable_stores = ?, applicable_products = ?, applicable_users = ? WHERE id = ?",
            [
                voucher_name,
                description,
                start_date,
                end_date,
                image,
                discount_type,
                discount_price,
                min_order_price || 0,
                _applicable_stores,
                _applicable_products,
                _applicable_users,
                voucher_id,
            ]
        );

        const [rows] = await pool.query(
            `SELECT * FROM Vouchers WHERE id = '${voucher_id}'`
        );

        return res
            .status(200)
            .json({ status: 200, message: "success", data: rows[0] });
    } catch (error) {
        return res.status(500).json({ status: 500, message: error.message });
    } finally {
        if (pool) await pool.end();
    }
}

export { getVouchers, getVoucher, getUserVouchers, createVoucher, editVoucher };
