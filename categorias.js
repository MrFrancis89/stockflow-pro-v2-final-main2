// categorias.js — StockFlow Pro v9.7.4
export const mapaCategorias = {
    'temperos': ['orégano', 'pimenta', 'canela', 'colorau', 'caldo', 'tempero', 'ervas', 'salsa', 'cebolinha', 'cominho', 'açafrão', 'páprica', 'curry'],
    'limpeza': ['detergente', 'sabão', 'esponja', 'água sanitária', 'desinfetante', 'papel', 'saco', 'lixo', 'bucha', 'álcool', 'limpador', 'multiuso', 'pano', 'vassoura'],
    'carnes': ['carne', 'frango', 'bacon', 'calabresa', 'presunto', 'peixe', 'hamburguer', 'linguiça', 'strogonoff', 'costela', 'bife'],
    'laticinios': ['queijo', 'mussarela', 'cheddar', 'requeijão', 'catupiry', 'leite', 'manteiga', 'iogurte', 'creme de leite', 'parmesão', 'provolone', 'gorgonzola'],
    'hortifruti': ['tomate', 'cebola', 'alho', 'batata', 'banana', 'limão', 'alface', 'rúcula', 'manjericão', 'pimentão', 'cenoura', 'azeitona', 'milho', 'ervilha', 'palmito', 'cogumelo', 'champignon', 'fruta', 'abacaxi', 'uva'],
    'mercearia': ['arroz', 'feijão', 'trigo', 'farinha', 'açúcar', 'sal', 'macarrão', 'óleo', 'azeite', 'fermento', 'fubá', 'molho', 'extrato', 'passata', 'ketchup', 'maionese', 'mostarda', 'chocolate', 'café', 'pão'],
    'bebidas': ['refrigerante', 'coca', 'guaraná', 'suco', 'água', 'cerveja', 'vinho', 'vodka', 'whisky', 'gelo', 'polpa'],
    'embalagens': ['caixa', 'sacola', 'plástico', 'filme', 'alumínio', 'isopor', 'guardanapo', 'canudo', 'copo']
};

export const coresCategorias = {
    'carnes': 'var(--cat-carnes)', 'laticinios': 'var(--cat-laticinios)',
    'hortifruti': 'var(--cat-horti)', 'mercearia': 'var(--cat-mercearia)',
    'temperos': 'var(--cat-temperos)', 'limpeza': 'var(--cat-limpeza)',
    'bebidas': 'var(--cat-bebidas)', 'embalagens': 'var(--cat-outros)',
    'outros': 'var(--cat-outros)'
};

export const nomesCategorias = {
    'carnes': 'CARNES & FRIOS',
    'laticinios': 'LATICÍNIOS',
    'hortifruti': 'HORTIFRUTI',
    'mercearia': 'MERCEARIA & GRÃOS',
    'temperos': 'TEMPEROS',
    'limpeza': 'LIMPEZA & DESCARTÁVEIS',
    'bebidas': 'BEBIDAS',
    'embalagens': 'EMBALAGENS',
    'outros': 'OUTROS'
};

export function identificarCategoria(nomeItem) {
    let nome = nomeItem.toLowerCase();
    const prioridade = ['temperos', 'limpeza', 'bebidas', 'laticinios', 'hortifruti', 'mercearia', 'carnes', 'embalagens'];

    // FIX: matching por palavra inteira em vez de substring simples.
    // "artesanal".includes("sal") retornaria true — agora não retorna.
    // Estratégia: verifica se o termo é palavra isolada, prefixo de palavra (≥4 chars)
    // ou frase composta (ex: "água sanitária", "creme de leite").
    // BUG FIX #11: a lógica anterior usava token.startsWith(termo) para termos
    // com ≥ 4 caracteres. Isso causava falsos positivos — ex.: "arroz" (5 chars)
    // marcaria "arrozeira" como mercearia; "molho" marcaria "molhosinho" etc.
    // A estratégia correta é sempre exigir correspondência de palavra inteira
    // (token === termo). Termos compostos com espaço continuam usando busca
    // de substring exata no nome completo (ex.: "água sanitária", "creme de leite").
    function temTermo(nome, termo) {
        if (termo.includes(' ')) {
            // Termos compostos: busca exata como substring (ex: "água sanitária")
            return nome.includes(termo);
        }
        // Termos simples: correspondência de palavra inteira — sem startsWith
        // para evitar falsos positivos em prefixos (ex: "sal" ≠ "salgado").
        const tokens = nome.split(/[\s,.()\-/]+/);
        return tokens.some(token => token === termo);
    }

    for (let i = 0; i < prioridade.length; i++) {
        let cat = prioridade[i];
        if (mapaCategorias[cat] && mapaCategorias[cat].some(termo => temTermo(nome, termo))) {
            return cat;
        }
    }
    return 'outros';
}