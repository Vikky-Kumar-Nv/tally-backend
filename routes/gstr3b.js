const express = require("express");
const router = express.Router();
const db = require("../db"); // assumes you have mysql2 setup

// ✅ Define 'safe' to prevent undefined values in SQL
function safe(val) {
  return val === undefined ? null : val;
}

router.post("/", async (req, res) => {
  const data = req.body;

  console.log("GSTR-3B Form Submission Payload:", data);

  try {
    const [result] = await db.execute(
      `INSERT INTO tbGstr3bReturns (
        employeeId, gstin, returnPeriod, outwardSupplies, interstateSupplies, 
        otherOutwardSupplies, nilRatedSupplies, inwardReverseCharge, nonGstSupplies, 
        inputTaxCreditEligible, inputTaxCreditIneligible, interestLateFees, taxPayable, taxPaid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safe(data.employeeId),
        safe(data.basicInfo?.gstin),
        safe(JSON.stringify(data.returnPeriod)),
        safe(JSON.stringify(data.outwardSupplies)),
        safe(JSON.stringify(data.interstateSupplies || {})),
        safe(JSON.stringify(data.otherOutwardSupplies || {})),
        safe(JSON.stringify(data.nilRatedSupplies || {})),
        safe(JSON.stringify(data.inwardSupplies?.reverseCharge || {})),
        safe(JSON.stringify(data.exemptNilNonGst || {})),
        safe(JSON.stringify(data.eligibleItc || {})),
        safe(JSON.stringify(data.itcReversed || {})),
        safe(JSON.stringify(data.interestLateFee || {})),
        safe(JSON.stringify(data.taxPayable || {})),
        safe(JSON.stringify(data.taxPaid || {})),
      ]
    );

    res.status(200).json({
      message: "GSTR-3B return submitted successfully",
      returnId: result.insertId,
    });
  } catch (error) {
    console.error("Database insert error:", error);
    res.status(500).json({ error: "Failed to submit GSTR-3B return" });
  }
});


module.exports = router;
