const express = require('express');
const router = express.Router();
const db = require('../db'); // adjust path

// Insert new group
router.post('/', async (req, res) => {
  try {
    const {
      name,
      alias,
      parent,
      type,
      nature,
      behavesLikeSubLedger,
      nettBalancesForReporting,
      usedForCalculation,
      allocationMethod,
      setAlterHSNSAC,
      hsnSacClassificationId,
      hsnCode,
      setAlterGST,
      gstClassificationId,
      typeOfSupply,
      taxability,
      integratedTaxRate,
      cess,    } = req.body;

    

    await db.execute(
      `INSERT INTO ledger_groups (
        name, alias, parent, type, nature,
        behavesLikeSubLedger, nettBalancesForReporting, usedForCalculation, allocationMethod,
        setAlterHSNSAC, hsnSacClassificationId, hsnCode,
        setAlterGST, gstClassificationId, typeOfSupply, taxability,
        integratedTaxRate, cess
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, alias || null, parent || null, type || null, nature || null,
        behavesLikeSubLedger ? 1 : 0,
        nettBalancesForReporting ? 1 : 0,
        usedForCalculation ? 1 : 0,
        allocationMethod || null,
        setAlterHSNSAC ? 1 : 0,
        hsnSacClassificationId || null,
        hsnCode || null,
        setAlterGST ? 1 : 0,
        gstClassificationId || null,
        typeOfSupply || null,
        taxability || null,
        integratedTaxRate || null,
        cess || null
      ]
    );

    res.json({ message: 'Group created successfully' });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ message: 'Failed to create group' });
  }
});


module.exports = router;
