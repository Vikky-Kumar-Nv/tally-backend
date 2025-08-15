const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise connection or pool

// Create new ITR statement
router.post("/", async (req, res) => {
  const { 
    employee_id, assessee, salary, business, houseProperty,
    capitalGain, otherSources, deductions80C, tdsDeducted, taxPayments 
  } = req.body;

  const connection = await db.getConnection();
  try {
    // Insert main record
    const [result] = await connection.query(
      `INSERT INTO itr_statements 
      (employee_id, assessee_name, father_name, address, pan, aadhar, email, date_of_birth, 
      assessment_year, financial_year,
      salary_income, section17_income, deduction16,
      business_net_profit, business_type, gross_turnover, section44ad, section44ab,
      house_annual_value, house_tenant1_name, house_tenant1_address, house_tenant1_pan,
      house_tenant2_name, house_tenant2_address, house_tenant2_pan, house_deduction30,
      capital_sale, capital_sale_date, capital_purchase_cost, capital_purchase_index,
      capital_improvement1_cost, capital_improvement1_index, capital_improvement2_cost, capital_improvement2_index,
      capital_improvement3_cost, capital_improvement3_index,
      agri_income, saving_interest_80tta, fd_interest_jhgrb, fd_interest_sbi, fd_interest_sahara, tuition_fee,
      life_insurance_premium, tuition_fee_1st2nd_child, tds_deducted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee_id,
        assessee.name, assessee.fatherName, assessee.address, assessee.pan, assessee.aadhar, assessee.email, assessee.dateOfBirth,
        assessee.assessmentYear, assessee.financialYear,
        salary.salaryIncome, salary.section17Income, salary.deduction16,
        business.netProfit, business.businessType, business.grossTurnover, business.section44AD ? 1 : 0, business.section44AB ? 1 : 0,
        houseProperty.annualValue, houseProperty.tenantName1, houseProperty.tenantAddress1, houseProperty.tenantPan1,
        houseProperty.tenantName2, houseProperty.tenantAddress2, houseProperty.tenantPan2, houseProperty.deduction30Percent,
        capitalGain.saleConsideration, capitalGain.saleDate, capitalGain.purchaseConsiderationCost, capitalGain.purchaseConsiderationIndex,
        capitalGain.improvementCost1, capitalGain.improvementIndex1,
        capitalGain.improvementCost2, capitalGain.improvementIndex2,
        capitalGain.improvementCost3, capitalGain.improvementIndex3,
        otherSources.agricultureIncome, otherSources.savingInterest80TTA, otherSources.fixedDepositJHGRB,
        otherSources.fixedDepositSBI, otherSources.fixedDepositSahara, otherSources.tuitionFee,
        deductions80C.lifeInsurancePremium, deductions80C.tuitionFeeFirstSecondChild,
        tdsDeducted
      ]
    );
    const itrId = result.insertId;

    // Insert policies
    if (deductions80C.policies) {
      for (const p of deductions80C.policies) {
        await connection.query(
          `INSERT INTO itr_policies (itr_statement_id, policy_date, policy_no, remark, value)
           VALUES (?, ?, ?, ?, ?)`,
          [itrId, p.date, p.policyNo, p.remark, p.value]
        );
      }
    }

    // Insert tax payments
    if (taxPayments) {
      for (const t of taxPayments) {
        await connection.query(
          `INSERT INTO itr_tax_payments (itr_statement_id, payment_date, cheque_no, bsr_code, bank_name, amount)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [itrId, t.date, t.chequeNo, t.bsrCode, t.bankName, t.amount]
        );
      }
    }

    res.json({ success: true, id: itrId });
  } catch (error) {
    res.status(500).json({ error: error.message || "Error inserting ITR" });
  } finally {
    connection.release();
  }
});

// Fetch ITRs for employee
router.get("/:employee_id", async (req, res) => {
  const { employee_id } = req.params;
  try {
    const [statements] = await db.query(
      "SELECT * FROM itr_statements WHERE employee_id = ?", 
      [employee_id]
    );
    for (const stmt of statements) {
      const [policies] = await db.query(
        "SELECT * FROM itr_policies WHERE itr_statement_id = ?", [stmt.id]
      );
      const [payments] = await db.query(
        "SELECT * FROM itr_tax_payments WHERE itr_statement_id = ?", [stmt.id]
      );
      stmt.policies = policies;
      stmt.taxPayments = payments;
    }
    res.json(statements);
  } catch (error) {
    res.status(500).json({ error: error.message || "Error fetching ITRs" });
  }
});

module.exports = router;
