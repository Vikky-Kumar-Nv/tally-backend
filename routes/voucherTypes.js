const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// Get all voucher types
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        type,
        abbreviation,
        numbering_method as numberingMethod,
        use_common_narration as useCommonNarration,
        print_after_saving as printAfterSaving,
        use_effective_dates as useEffectiveDates,
        make_optional_default as makeOptionalDefault,
        restart_numbering_applicable as restartNumberingApplicable,
        restart_numbering_starting_number as restartNumberingStartingNumber,
        restart_numbering_particulars as restartNumberingParticulars,
        prefix_details_applicable as prefixDetailsApplicable,
        prefix_details_particulars as prefixDetailsParticulars,
        suffix_details_applicable as suffixDetailsApplicable,
        suffix_details_particulars as suffixDetailsParticulars,
        narrations_for_each_entry as narrationsForEachEntry,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM voucher_types
      ORDER BY name
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching voucher types:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      // Transform the flat database structure to nested structure
      const transformedResults = results.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        abbreviation: row.abbreviation,
        numberingMethod: row.numberingMethod,
        useCommonNarration: !!row.useCommonNarration,
        printAfterSaving: !!row.printAfterSaving,
        useEffectiveDates: !!row.useEffectiveDates,
        makeOptionalDefault: !!row.makeOptionalDefault,
        restartNumbering: {
          applicable: !!row.restartNumberingApplicable,
          startingNumber: row.restartNumberingStartingNumber || 1,
          particulars: row.restartNumberingParticulars || ''
        },
        prefixDetails: {
          applicable: !!row.prefixDetailsApplicable,
          particulars: row.prefixDetailsParticulars || ''
        },
        suffixDetails: {
          applicable: !!row.suffixDetailsApplicable,
          particulars: row.suffixDetailsParticulars || ''
        },
        narrationsForEachEntry: !!row.narrationsForEachEntry,
        isActive: !!row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));

      res.json(transformedResults);
    });
  } catch (error) {
    console.error('Error in GET /voucher-types:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single voucher type by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        name,
        type,
        abbreviation,
        numbering_method as numberingMethod,
        use_common_narration as useCommonNarration,
        print_after_saving as printAfterSaving,
        use_effective_dates as useEffectiveDates,
        make_optional_default as makeOptionalDefault,
        restart_numbering_applicable as restartNumberingApplicable,
        restart_numbering_starting_number as restartNumberingStartingNumber,
        restart_numbering_particulars as restartNumberingParticulars,
        prefix_details_applicable as prefixDetailsApplicable,
        prefix_details_particulars as prefixDetailsParticulars,
        suffix_details_applicable as suffixDetailsApplicable,
        suffix_details_particulars as suffixDetailsParticulars,
        narrations_for_each_entry as narrationsForEachEntry,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM voucher_types
      WHERE id = ?
    `;

    db.query(query, [id], (err, results) => {
      if (err) {
        console.error('Error fetching voucher type:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Voucher type not found' });
      }

      const row = results[0];
      const transformedResult = {
        id: row.id,
        name: row.name,
        type: row.type,
        abbreviation: row.abbreviation,
        numberingMethod: row.numberingMethod,
        useCommonNarration: !!row.useCommonNarration,
        printAfterSaving: !!row.printAfterSaving,
        useEffectiveDates: !!row.useEffectiveDates,
        makeOptionalDefault: !!row.makeOptionalDefault,
        restartNumbering: {
          applicable: !!row.restartNumberingApplicable,
          startingNumber: row.restartNumberingStartingNumber || 1,
          particulars: row.restartNumberingParticulars || ''
        },
        prefixDetails: {
          applicable: !!row.prefixDetailsApplicable,
          particulars: row.prefixDetailsParticulars || ''
        },
        suffixDetails: {
          applicable: !!row.suffixDetailsApplicable,
          particulars: row.suffixDetailsParticulars || ''
        },
        narrationsForEachEntry: !!row.narrationsForEachEntry,
        isActive: !!row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };

      res.json(transformedResult);
    });
  } catch (error) {
    console.error('Error in GET /voucher-types/:id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new voucher type
router.post('/', async (req, res) => {
  try {
    const {
      name,
      type,
      abbreviation,
      numberingMethod,
      useCommonNarration,
      printAfterSaving,
      useEffectiveDates,
      makeOptionalDefault,
      restartNumbering,
      prefixDetails,
      suffixDetails,
      narrationsForEachEntry,
      isActive
    } = req.body;

    // Validate required fields
    if (!name || !type || !abbreviation) {
      return res.status(400).json({ 
        message: 'Name, type, and abbreviation are required' 
      });
    }

    // Check if abbreviation already exists
    const checkQuery = 'SELECT id FROM voucher_types WHERE abbreviation = ?';
    db.query(checkQuery, [abbreviation], (err, existing) => {
      if (err) {
        console.error('Error checking existing abbreviation:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (existing.length > 0) {
        return res.status(400).json({ 
          message: 'Abbreviation already exists. Please choose a different one.' 
        });
      }

      // Create new voucher type
      const id = uuidv4();
      const insertQuery = `
        INSERT INTO voucher_types (
          id,
          name,
          type,
          abbreviation,
          numbering_method,
          use_common_narration,
          print_after_saving,
          use_effective_dates,
          make_optional_default,
          restart_numbering_applicable,
          restart_numbering_starting_number,
          restart_numbering_particulars,
          prefix_details_applicable,
          prefix_details_particulars,
          suffix_details_applicable,
          suffix_details_particulars,
          narrations_for_each_entry,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const values = [
        id,
        name,
        type,
        abbreviation,
        numberingMethod || 'automatic',
        useCommonNarration || false,
        printAfterSaving || false,
        useEffectiveDates || false,
        makeOptionalDefault || false,
        restartNumbering?.applicable || false,
        restartNumbering?.startingNumber || 1,
        restartNumbering?.particulars || '',
        prefixDetails?.applicable || false,
        prefixDetails?.particulars || '',
        suffixDetails?.applicable || false,
        suffixDetails?.particulars || '',
        narrationsForEachEntry !== undefined ? narrationsForEachEntry : true,
        isActive !== undefined ? isActive : true
      ];

      db.query(insertQuery, values, (err, result) => {
        if (err) {
          console.error('Error creating voucher type:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }

        res.status(201).json({ 
          message: 'Voucher type created successfully',
          id: id
        });
      });
    });
  } catch (error) {
    console.error('Error in POST /voucher-types:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update voucher type
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      abbreviation,
      numberingMethod,
      useCommonNarration,
      printAfterSaving,
      useEffectiveDates,
      makeOptionalDefault,
      restartNumbering,
      prefixDetails,
      suffixDetails,
      narrationsForEachEntry,
      isActive
    } = req.body;

    // Validate required fields
    if (!name || !type || !abbreviation) {
      return res.status(400).json({ 
        message: 'Name, type, and abbreviation are required' 
      });
    }

    // Check if abbreviation already exists (excluding current record)
    const checkQuery = 'SELECT id FROM voucher_types WHERE abbreviation = ? AND id != ?';
    db.query(checkQuery, [abbreviation, id], (err, existing) => {
      if (err) {
        console.error('Error checking existing abbreviation:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (existing.length > 0) {
        return res.status(400).json({ 
          message: 'Abbreviation already exists. Please choose a different one.' 
        });
      }

      // Update voucher type
      const updateQuery = `
        UPDATE voucher_types SET
          name = ?,
          type = ?,
          abbreviation = ?,
          numbering_method = ?,
          use_common_narration = ?,
          print_after_saving = ?,
          use_effective_dates = ?,
          make_optional_default = ?,
          restart_numbering_applicable = ?,
          restart_numbering_starting_number = ?,
          restart_numbering_particulars = ?,
          prefix_details_applicable = ?,
          prefix_details_particulars = ?,
          suffix_details_applicable = ?,
          suffix_details_particulars = ?,
          narrations_for_each_entry = ?,
          is_active = ?,
          updated_at = NOW()
        WHERE id = ?
      `;

      const values = [
        name,
        type,
        abbreviation,
        numberingMethod || 'automatic',
        useCommonNarration || false,
        printAfterSaving || false,
        useEffectiveDates || false,
        makeOptionalDefault || false,
        restartNumbering?.applicable || false,
        restartNumbering?.startingNumber || 1,
        restartNumbering?.particulars || '',
        prefixDetails?.applicable || false,
        prefixDetails?.particulars || '',
        suffixDetails?.applicable || false,
        suffixDetails?.particulars || '',
        narrationsForEachEntry !== undefined ? narrationsForEachEntry : true,
        isActive !== undefined ? isActive : true,
        id
      ];

      db.query(updateQuery, values, (err, result) => {
        if (err) {
          console.error('Error updating voucher type:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Voucher type not found' });
        }

        res.json({ message: 'Voucher type updated successfully' });
      });
    });
  } catch (error) {
    console.error('Error in PUT /voucher-types/:id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle voucher type active status
router.patch('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updateQuery = `
      UPDATE voucher_types SET
        is_active = ?,
        updated_at = NOW()
      WHERE id = ?
    `;

    db.query(updateQuery, [isActive, id], (err, result) => {
      if (err) {
        console.error('Error toggling voucher type status:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Voucher type not found' });
      }

      res.json({ 
        message: `Voucher type ${isActive ? 'activated' : 'deactivated'} successfully` 
      });
    });
  } catch (error) {
    console.error('Error in PATCH /voucher-types/:id/toggle-status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete voucher type
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if voucher type is being used in any vouchers
    const checkUsageQuery = 'SELECT COUNT(*) as count FROM vouchers WHERE voucher_type_id = ?';
    
    db.query(checkUsageQuery, [id], (err, result) => {
      if (err) {
        console.error('Error checking voucher type usage:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      const usageCount = result[0].count;
      if (usageCount > 0) {
        return res.status(400).json({ 
          message: `Cannot delete voucher type. It is being used in ${usageCount} voucher(s).` 
        });
      }

      // Delete voucher type
      const deleteQuery = 'DELETE FROM voucher_types WHERE id = ?';
      
      db.query(deleteQuery, [id], (err, result) => {
        if (err) {
          console.error('Error deleting voucher type:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Voucher type not found' });
        }

        res.json({ message: 'Voucher type deleted successfully' });
      });
    });
  } catch (error) {
    console.error('Error in DELETE /voucher-types/:id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
