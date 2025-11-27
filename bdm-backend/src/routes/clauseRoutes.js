const express = require('express');
const router = express.Router();
const clauseController = require('../controllers/clauseController');


router.get('/', clauseController.getAllClauses);


router.get('/:id', clauseController.getClauseById);

router.get('/category/:category', clauseController.getClausesByCategory);


router.post('/manual', clauseController.createClauseManually);

router.put('/:id', clauseController.updateClause);

router.delete('/:id', clauseController.deleteClause);




router.post('/save-ai-generated', clauseController.saveAIGeneratedClauses);


router.post('/generate-ai', clauseController.generateClausesWithAI);


router.post('/generate-single-ai', clauseController.generateSingleClauseWithAI);


router.post('/save-ai-generated', clauseController.saveAIGeneratedClauses);



module.exports = router;