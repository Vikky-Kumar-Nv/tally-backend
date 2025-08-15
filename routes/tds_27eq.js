const express = require("express");
const router = express.Router();
const db = require("../db"); // your mysql2 pool connection

// POST: Create new Form 27EQ return with challan and collectee details
router.post("/api/tcs27eq", async (req, res) => {
  const {
    collectorDetails,
    challanDetails,
    collecteeDetails,
    verification
  } = req.body;

  if (!collectorDetails || !challanDetails || !collecteeDetails || !verification) {
    return res.status(400).json({ error: "Missing required form parts" });
  }
  


  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Insert main return record
    const [result] = await conn.query(
      `INSERT INTO tcs_27eq_returns (
        tan, financial_year, quarter, pan_of_collector, type_of_collector, collector_name,
        flat_no, premises_name, road_street, area, town, state, pin_code,
        mobile_no, alternate_mobile, email, alternate_email,
        responsible_person_name, responsible_person_pan, responsible_person_designation,
        responsible_person_flat_no, responsible_person_premises_name, responsible_person_road_street, responsible_person_area, responsible_person_town,
        responsible_person_state, responsible_person_pin_code, responsible_person_mobile_no, responsible_person_alternate_mobile, responsible_person_email,
        verification_capacity, verification_place, verification_date, verification_full_name, verification_designation, verification_signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        collectorDetails.tan,
        collectorDetails.financialYear,
        collectorDetails.quarter,
        collectorDetails.panOfCollector,
        collectorDetails.typeOfCollector,
        collectorDetails.collectorName,
        collectorDetails.address.flatNo,
        collectorDetails.address.premisesName,
        collectorDetails.address.roadStreet,
        collectorDetails.address.area,
        collectorDetails.address.town,
        collectorDetails.address.state,
        collectorDetails.address.pinCode,
        collectorDetails.mobileNo,
        collectorDetails.alternateMobile,
        collectorDetails.email,
        collectorDetails.alternateEmail,
        collectorDetails.responsiblePerson.name,
        collectorDetails.responsiblePerson.pan,
        collectorDetails.responsiblePerson.designation,
        collectorDetails.responsiblePerson.address.flatNo,
        collectorDetails.responsiblePerson.address.premisesName,
        collectorDetails.responsiblePerson.address.roadStreet,
        collectorDetails.responsiblePerson.address.area,
        collectorDetails.responsiblePerson.address.town,
        collectorDetails.responsiblePerson.address.state,
        collectorDetails.responsiblePerson.address.pinCode,
        collectorDetails.responsiblePerson.mobileNo,
        collectorDetails.responsiblePerson.alternateMobile,
        collectorDetails.responsiblePerson.email,
        verification.capacity,
        verification.declarationPlace,
        verification.declarationDate,
        verification.fullName,
        verification.designation,
        verification.signature
      ]
    );

    const returnId = result.insertId;

    // 2. Insert challan details in batch
    if (challanDetails.length > 0) {
      const placeholders = challanDetails.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",");
      const values = challanDetails.flatMap((ch, idx) => [
        returnId,
        ch.serialNo ?? idx + 1,
        ch.bsrCode ?? "",
        ch.dateOfDeposit,
        ch.challanSerialNo ?? "",
        ch.tax ?? 0,
        ch.surcharge ?? 0,
        ch.educationCess ?? 0,
        ch.interest ?? 0,
        ch.fee ?? 0,
        ch.total ?? 0,
        ch.minorHead ?? ""
      ]);
      await conn.query(
        `INSERT INTO tcs_27eq_challans 
        (return_id, serial_no, bsr_code, date_of_deposit, challan_serial_no, tax, surcharge, education_cess, interest, fee, total, minor_head) 
        VALUES ${placeholders}`,
        values
      );
    }

    // 3. Insert collectee details in batch
    if (collecteeDetails.length > 0) {
      const placeholders = collecteeDetails.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",");
      const values = collecteeDetails.flatMap((de, idx) => [
        returnId,
        de.serialNo ?? idx + 1,
        de.panOfCollectee ?? "",
        de.nameOfCollectee ?? "",
        de.amountPaid ?? 0,
        de.taxCollected ?? 0,
        de.taxDeposited ?? 0,
        de.dateOfCollection,
        de.sectionCode ?? "",
        de.rateOfCollection ?? 0,
        de.remarkCode ?? ""
      ]);
      await conn.query(
        `INSERT INTO tcs_27eq_collectees
        (return_id, serial_no, pan_of_collectee, name_of_collectee, amount_paid, tax_collected, tax_deposited, date_of_collection, section_code, rate_of_collection, remark_code) 
        VALUES ${placeholders}`,
        values
      );
    }

    await conn.commit();
    conn.release();

    res.json({ success: true, message: "Form 27EQ saved successfully", returnId });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error("Error in Form 27EQ insert:", err);
    res.status(500).json({ error: "Failed to save Form 27EQ", details: err.message });
  }
});

// GET: List returns (optionally filter by year and quarter)
router.get("/api/tcs27eq", async (req, res) => {
  const { year, quarter } = req.query;

  let sql = `
    SELECT 
      r.id, 
      r.tan, 
      r.collector_name, 
      r.financial_year, 
      r.quarter, 
      r.created_at,
      COUNT(c.id) AS challan_count,
      COALESCE(SUM(c.total), 0) AS total_tax_deposited,
      COUNT(co.id) AS collectee_count,
      COALESCE(SUM(co.tax_collected), 0) AS total_tax_collected
    FROM tcs_27eq_returns r
    LEFT JOIN tcs_27eq_challans c ON r.id = c.return_id
    LEFT JOIN tcs_27eq_collectees co ON r.id = co.return_id
    WHERE 1=1
  `;

  const params = [];
  if (year) {
    sql += " AND r.financial_year = ?";
    params.push(year);
  }
  if (quarter) {
    sql += " AND r.quarter = ?";
    params.push(quarter);
  }
  sql += " GROUP BY r.id ORDER BY r.created_at DESC";

  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching Form 27EQ returns:", err);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
});

module.exports = router;
