
document.getElementById('search-field').addEventListener('input', onInputSearch);

async function onInputSearch(event){
    const query = event.target.value;

    if (query.length < 1) {
        clearSuggestions();
        return;
    }

    const apiUrl = `/autocomplete-title?title=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }

        const suggestions = await response.json();
        showSuggestions(suggestions);
    } catch (error) {
        console.error('Error fetching autocomplete results:', error);
    }
}

/**
 * Mostra i suggerimenti di autocomplete aggiornando il datalist.
 *
 * @param {string[]} suggestions - Un array di suggerimenti per l'autocomplete.
 */
function showSuggestions(suggestions) {
    const dataList = document.getElementById('suggestions');

    // Per evitare: dataList.innerHTML = '';
    while(dataList.firstChild)
    {
        dataList.removeChild(dataList.firstChild);
    }

    console.log({suggestions})
    suggestions.forEach(suggestion => {
        console.log({suggestion})
        const option = document.createElement('option');
        option.value = suggestion.title;
        dataList.appendChild(option);
    });
}

/**
 * Pulisce i suggerimenti di autocomplete dal datalist.
 */
function clearSuggestions() {
    const dataList = document.getElementById('suggestions');
    // Per evitare: dataList.innerHTML = '';
    while(dataList.firstChild)
    {
        dataList.removeChild(dataList.firstChild);
    }
}
