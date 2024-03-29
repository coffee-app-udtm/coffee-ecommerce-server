import connectToDB from "../config/db.js";

async function getOrders(req, res) {
    const pool = await connectToDB();
    try {
        const [rows] = await pool.execute(
            `SELECT Orders.*, Users.id AS user_id, Users.user_name, Users.email, Users.avatar
            FROM Orders
            LEFT JOIN Users ON Users.id = Orders.user_id`
        );

        await pool.end();
        return res
            .status(200)
            .json({ status: 200, message: "success", data: rows });
    } catch (error) {
        await pool.end();

        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function getUserOrders(req, res) {
    const pool = await connectToDB();
    const user_id = req.params.user_id;

    try {
        const [rows] = await pool.execute(
            `SELECT Orders.*, Users.id AS user_id, Users.user_name, Users.email, Users.avatar
            FROM Orders
            LEFT JOIN Users ON Users.id = Orders.user_id
            WHERE Orders.user_id = '${user_id}'`
        );

        await pool.end();
        return res
            .status(200)
            .json({ status: 200, message: "success", data: rows });
    } catch (error) {
        await pool.end();

        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function getOrderInfo(req, res) {
    const pool = await connectToDB();
    try {
        await pool.beginTransaction();
        const orderDetailData = [];

        const order_id = req.params.id;
        const [orders, fields] = await pool.query(
            `SELECT Orders.*, Users.id AS user_id, 
            Users.user_name, Users.email, Users.avatar, Vouchers.id AS voucher_id, Vouchers.voucher_name, Stores.id AS store_id, Stores.store_name
            FROM Orders 
            LEFT JOIN Users ON Users.id = Orders.user_id
            LEFT JOIN Vouchers ON Vouchers.id = Orders.voucher_id 
            LEFT JOIN Stores ON Stores.id = Orders.store_id 
            WHERE Orders.id = '${order_id}'`
        );

        const [orderDetails] = await pool.query(
            `SELECT 
            od.id,
            p.id AS product_id,
            p.name AS product_name,
            p.price AS product_price,
            p.image AS product_image,
            s.size_name AS size,
            ps.size_price AS size_price,
            od.quantity AS quantity
            FROM 
                OrderDetails od
            LEFT JOIN 
                Products p ON od.product_id = p.id
            LEFT JOIN 
                ProductSizes ps ON od.product_id = ps.product_id AND od.size_id = ps.size_id
            LEFT JOIN 
                Sizes s ON od.size_id = s.id
            WHERE
                od.order_id = '${order_id}'
            GROUP BY
                od.id, p.name, p.price, p.image, s.size_name, ps.size_price, od.quantity;`
        );

        for (const orderDetail of orderDetails) {
            const [orderToppings] = await pool.query(
                `SELECT
                ts.id AS topping_storage_id,
                t.topping_name,
                t.topping_price
                FROM
                    ToppingStorages ts
                LEFT JOIN
                    Toppings t ON ts.topping_id = t.id
                WHERE
                    ts.order_detail_id = '${orderDetail.order_id}' `
            );

            orderDetailData.push({
                ...orderDetail,
                toppings: orderToppings,
                total_item_price:
                    (orderToppings.reduce(
                        (acc, curr) => acc + parseFloat(curr.topping_price),
                        0
                    ) +
                        parseFloat(orderDetail.product_price) +
                        parseFloat(orderDetail.size_price)) *
                    parseFloat(orderDetail.quantity),
            });
        }

        const orderInfo = {
            ...orders[0],
            order_detail: orderDetailData,
        };

        await pool.commit();
        await pool.end();
        return res
            .status(200)
            .json({ status: 200, message: "success", data: orderInfo });
    } catch (error) {
        await pool.rollback();
        await pool.end();

        return res.status(500).json({ status: 500, message: error.message });
    }
}
async function createOrder(req, res) {
    const pool = await connectToDB();
    try {
        const {
            order_id,
            user_id,
            total_payment,
            payment_method,
            order_status,
            order_type,
            order_note,
            shipping_cost,
            receiver_name,
            phone_number,
            address,
            store_id,
            voucher_id,
            order_items,
        } = req.body;

        let sql = "";
        let values;

        const order_date = new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");

        if (voucher_id) {
            sql = `
            INSERT INTO Orders 
            (id, user_id, total_payment, payment_method, order_status, order_type, order_date, order_note, shipping_cost, receiver_name, phone_number, address, store_id, voucher_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            values = [
                order_id,
                user_id,
                total_payment,
                payment_method,
                order_status,
                order_type,
                order_date,
                order_note,
                shipping_cost,
                receiver_name,
                phone_number,
                address,
                store_id,
                voucher_id,
            ];
        } else {
            sql = `
            INSERT INTO Orders 
            (id, user_id, total_payment, payment_method, order_status, order_type, order_date, order_note, shipping_cost, receiver_name, phone_number, address, store_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            values = [
                order_id,
                user_id,
                total_payment,
                payment_method,
                order_status,
                order_type,
                order_date,
                order_note,
                shipping_cost,
                receiver_name,
                phone_number,
                address,
                store_id,
            ];
        }

        await pool.beginTransaction();

        const [orderResult] = await pool.query(sql, values);

        // Insert into order details table
        for (const order_item of order_items) {
            const [orderDetailResult] = await pool.query(
                "INSERT INTO OrderDetails (order_id, order_item_price, product_id, size_id, quantity) VALUES (?, ?, ?, ?, ?)",
                [
                    order_id,
                    order_item.order_item_price,
                    order_item.product_id,
                    order_item.size_id,
                    order_item.quantity,
                ]
            );

            if (order_item.toppings.length > 0) {
                for (const topping of order_item.toppings) {
                    await pool.query(
                        "INSERT INTO ToppingStorages (topping_id, order_detail_id) VALUES (?, ?)",
                        [topping, orderDetailResult.insertId]
                    );
                }
            }
        }

        const [rows] = await pool.query(
            `SELECT Orders.*, Users.id AS user_id, Users.user_name, Users.email, Users.avatar
            FROM Orders
            LEFT JOIN Users ON Users.id = Orders.user_id WHERE Orders.id = '${order_id}'`
        );

        await pool.commit();
        await pool.end();
        return res
            .status(200)
            .json({ status: 200, message: "success", data: rows[0] });
    } catch (error) {
        await pool.rollback();
        await pool.end();

        return res.status(500).json({ status: 500, message: error.message });
    }
}
async function editOrderStatus(req, res) {
    const pool = await connectToDB();

    try {
        const order_id = req.params.id;
        const { order_status } = req.body;
        await pool.beginTransaction();

        const [result] = await pool.query(
            "UPDATE Orders SET order_status = ? WHERE id = ?",
            [order_status, order_id]
        );

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ status: 400, message: "Cant update order status" });
        }

        await pool.commit();
        await pool.end();

        return res.status(200).json({ status: 200, message: "success" });
    } catch (error) {
        await pool.rollback();
        await pool.commit();

        return res.status(500).json({ status: 500, message: error.message });
    }
}

export { createOrder, getOrders, getOrderInfo, editOrderStatus, getUserOrders };