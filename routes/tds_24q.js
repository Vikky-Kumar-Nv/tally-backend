// POST /api/tds24q/create
const express = require("express");
const router = express.Router();
const db = require("../db"); // assumes you have mysql2 setup

// ✅ Define 'safe' to prevent undefined values in SQL

router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      taxDeductionAccount,
      deductorDetails,
      responsiblePersonDetails,
      taxDetails,
      employeeSalaryDetails,
      verification
    } = req.body;

    // 1. Insert into tds_24q_returns
    const [returnResult] = await conn.query(
      `INSERT INTO tds_24q_returns (
        tax_deduction_account_no, permanent_account_no, financial_year, assessment_year,
        has_statement_filed_earlier, provisional_receipt_no,
        deductor_name, deductor_type, branch_division,
        deductor_flat_no, deductor_name_of_premises_building, deductor_road_street_lane,
        deductor_area_location, deductor_town_city_district, deductor_state, deductor_pin_code,
        deductor_telephone_no, deductor_email,
        responsible_person_name,
        responsible_person_flat_no, responsible_person_name_of_premises_building,
        responsible_person_road_street_lane, responsible_person_area_location,
        responsible_person_town_city_district, responsible_person_state,
        responsible_person_pin_code, responsible_person_telephone_no,
        responsible_person_email,
        verification_place, verification_date,
        verification_name_of_person_responsible, verification_designation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taxDeductionAccount.taxDeductionAccountNo,
        taxDeductionAccount.permanentAccountNo,
        taxDeductionAccount.financialYear,
        taxDeductionAccount.assessmentYear,
        taxDeductionAccount.hasStatementFiledEarlier,
        taxDeductionAccount.provisionalReceiptNo || null,
        deductorDetails.name,
        deductorDetails.typeOfDeductor,
        deductorDetails.branchDivision || null,
        deductorDetails.address.flatNo || null,
        deductorDetails.address.nameOfPremisesBuilding || null,
        deductorDetails.address.roadStreetLane || null,
        deductorDetails.address.areaLocation || null,
        deductorDetails.address.townCityDistrict,
        deductorDetails.address.state,
        deductorDetails.address.pinCode,
        deductorDetails.telephoneNo || null,
        deductorDetails.email,
        responsiblePersonDetails.name,
        responsiblePersonDetails.address.flatNo || null,
        responsiblePersonDetails.address.nameOfPremisesBuilding || null,
        responsiblePersonDetails.address.roadStreetLane || null,
        responsiblePersonDetails.address.areaLocation || null,
        responsiblePersonDetails.address.townCityDistrict,
        responsiblePersonDetails.address.state,
        responsiblePersonDetails.address.pinCode,
        responsiblePersonDetails.telephoneNo || null,
        responsiblePersonDetails.email,
        verification.place,
        verification.date,
        verification.nameOfPersonResponsible,
        verification.designation,
      ]
    );

    const returnId = returnResult.insertId;

    // 2. Insert Tax Details
    if (taxDetails && taxDetails.length > 0) {
      const taxRows = taxDetails.map(tax => [
        returnId,
        tax.srNo,
        tax.tds,
        tax.surcharge || 0,
        tax.educationCess || 0,
        tax.interest || 0,
        tax.others || 0,
        tax.totalTaxDeposited,
        tax.chequeDD || null,
        tax.bsrCode || null,
        tax.dateOnWhichTaxDeposited,
        tax.transferVoucherChallanSerialNo || null,
        tax.whetherTDSDepositedByBookEntry
      ]);

      await conn.query(
        `INSERT INTO tds_24q_tax_details (
          return_id, sr_no, tds, surcharge, education_cess, interest, others, total_tax_deposited,
          cheque_dd, bsr_code, date_on_which_tax_deposited,
          transfer_voucher_challan_serial_no, whether_tds_deposited_by_book_entry
        ) VALUES ?`,
        [taxRows]
      );
    }

    // 3. Insert Employee Salary Details
    if (employeeSalaryDetails && employeeSalaryDetails.length > 0) {
      const employeeRows = employeeSalaryDetails.map(emp => [
        returnId,
        emp.srNo,
        emp.nameOfEmployee,
        emp.panOfEmployee,
        emp.employeeReferenceNo || null,
        emp.addressOfEmployee || null,
        emp.amountOfSalaryPaid,
        emp.taxDeducted,
        emp.dateOfPayment,
        emp.periodOfPayment || null,
        emp.natureOfPayment || null,
        emp.sectionUnderWhichDeducted,
        emp.rateOfTDS,
        emp.certificateNo || null,
        emp.quarterInWhichAmountPaid
      ]);

      await conn.query(
        `INSERT INTO tds_24q_employee_salary_details (
          return_id, sr_no, name_of_employee, pan_of_employee, employee_reference_no, address_of_employee,
          amount_of_salary_paid, tax_deducted, date_of_payment, period_of_payment,
          nature_of_payment, section_under_which_deducted, rate_of_tds, certificate_no, quarter_in_which_amount_paid
        ) VALUES ?`,
        [employeeRows]
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'TDS 24Q return saved successfully', returnId });
  } catch (error) {
    await conn.rollback();
    console.error('Error saving TDS 24Q return:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  } finally {
    conn.release();
  }
});

// GET /api/tds24q?year=YYYY-YY
router.get('/', async (req, res) => {
  try {
    const year = req.query.year;
    if (!year) {
      return res.status(400).json({ error: "Missing 'year' query parameter" });
    }

    // Query: returns with aggregated totalDeductees & totalTDS from salary details and max quarter
    const sql = `
      SELECT 
        r.id,
        COALESCE(MAX(esd.quarter_in_which_amount_paid), 'Q4') AS quarter,
        r.financial_year AS year,
        -- Use your own status logic or add a column in your table. Here I use 'has_statement_filed_earlier' just for demo
        CASE WHEN r.has_statement_filed_earlier = 'Yes' THEN 'filed' ELSE 'draft' END AS status,
        NULL AS acknowledgment_no,
        NULL AS submission_date,
        NULL AS ver_date,
        NULL AS ver_place,
        (SELECT COUNT(*) FROM tds_24q_employee_salary_details esd2 WHERE esd2.return_id = r.id) AS totalDeductees,
        (SELECT IFNULL(SUM(tax_deducted), 0) FROM tds_24q_employee_salary_details esd2 WHERE esd2.return_id = r.id) AS totalTDS
      FROM tds_24q_returns r
      LEFT JOIN tds_24q_employee_salary_details esd ON r.id = esd.return_id
      WHERE r.financial_year = ?
      GROUP BY r.id, r.financial_year, r.has_statement_filed_earlier
      ORDER BY r.financial_year DESC, r.id DESC
    `;

    const [rows] = await db.query(sql, [year]);

    const results = rows.map(row => ({
      id: row.id,
      quarter: row.quarter || 'Q4',
      year: row.year,
      status: (row.status || 'draft').toLowerCase(),
      acknowledgment_no: row.acknowledgment_no,
      submission_date: row.submission_date,
      ver_date: row.ver_date,
      ver_place: row.ver_place,
      totalDeductees: Number(row.totalDeductees || 0),
      totalTDS: Number(row.totalTDS || 0)
    }));

    res.json(results);
  } catch (error) {
    console.error("Error in /api/tds24q:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
module.exports = router;
