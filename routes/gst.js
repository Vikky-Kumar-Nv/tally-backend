const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/", async (req, res) => {
  const {
    state,
    registrationType,
    assesseeOfOtherTerritory,
    gstNumber,
    periodicityOfGstr1,
    gstApplicableFrom,
    eWayBillApplicable,
    eWayBillThresholdLimit,
    eWayBillIntrastate,
    provideLutBond,
    lutBondNumber,
    lutBondValidity,
    taxLiabilityOnAdvanceReceipts
  } = req.body;

  try {
    const [result] = await db.execute(
      `INSERT INTO tbGstRegistrations (
        state, registrationType, assesseeOfOtherTerritory, gstNumber,
        periodicityOfGstr1, gstApplicableFrom, eWayBillApplicable,
        eWayBillThresholdLimit, eWayBillIntrastate,
        provideLutBond, lutBondNumber, lutBondValidity,
        taxLiabilityOnAdvanceReceipts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        state,
        registrationType,
        assesseeOfOtherTerritory,
        gstNumber,
        periodicityOfGstr1,
        gstApplicableFrom,
        eWayBillApplicable,
        eWayBillApplicable === 'yes' ? eWayBillThresholdLimit : null,
        eWayBillApplicable === 'yes' ? eWayBillIntrastate : null,
        provideLutBond,
        provideLutBond === 'yes' ? lutBondNumber : null,
        provideLutBond === 'yes' ? lutBondValidity : null,
        taxLiabilityOnAdvanceReceipts
      ]
    );

    res.status(201).json({ success: true, id: result.insertId, message: "GST Registration saved successfully." });
  } catch (error) {
    console.error("🔥 Error inserting GST registration:", error);
    res.status(500).json({ success: false, error: "Server error saving GST registration." });
  }
});

module.exports = router;
