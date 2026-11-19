import noImage from '../images/noimage.png'

const apiUrl = 'https://api.smk.dk/api/v1/art/search/';

export const rows = 1000;

const artworksInfo = {
    title:[],
    author:[],
    year:[],
    description:[],
    webUrl:[],
    onDisplay:[],

    image: {
        orientation:[],
        imageUrl:[]
    },
}



export async function getArtworks(offset = 0) {
    try {
        const response = await fetch(
            `${apiUrl}?keys=*&offset=${offset}&rows=${rows}`
        );
        if (!response.ok) {
            throw new Error(`SMK API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const newItemsStartIndex = artworksInfo.title.length;

        data.items.forEach(artwork => { 
            // Gather all needed data from API
            const title = artwork.documentation?.[0]?.title || artwork?.titles[0]?.title || 'Undefined';
            const author = artwork.documentation?.[0]?.author || artwork?.artist[0] || 'Undefined';
            const year = artwork.documentation?.[0]?.year_of_publication ?? 'Undefined';
            const webUrl = artwork?.frontend_url ?? 'Undefined';
            const display = artwork?.on_display ?? 'Undefined';
            
            const thumbnail = artwork?.image_thumbnail ?? noImage;
            const orientation = artwork?.image_orientation ?? 'Undefined';

            // Push all data to local object
            artworksInfo.title.push(title);
            artworksInfo.author.push(author);
            artworksInfo.year.push(year);
            artworksInfo.webUrl.push(webUrl);
            artworksInfo.onDisplay.push(display);

            artworksInfo.image.imageUrl.push(thumbnail);
            artworksInfo.image.orientation.push(orientation);
            console.log(data);
        })
        renderArtwork(newItemsStartIndex);
        return data.items.length;

    } catch(err){
        console.error('Error while retreiving artworks :', err);
        throw err;
    }
}

function renderArtwork(startIndex) {
    // Container for artworks (parent)
    const artworkList = document.getElementById('artwork');
    if (!artworkList) {
        throw new Error('Artwork list element was not found');
    }

    for (let i = startIndex; i < artworksInfo.title.length; i++){
        /* Create necessary elements for all cards */
        const card = document.createElement('div');
        const cardTitle = document.createElement('h3');
        const cardAuthor = document.createElement('p');
        const cardYear = document.createElement('p');
        const cardDisplay = document.createElement('p');
        const cardBtn = document.createElement('a');

        const cardImage = document.createElement('img');

        /* Insert data */
        cardTitle.innerHTML = `${artworksInfo.title[i]}`;
        cardAuthor.innerHTML = `${artworksInfo.author[i]}`;
        cardYear.innerHTML = `${artworksInfo.year[i]}`;

        cardImage.src = artworksInfo.image?.imageUrl[i];
        if (artworksInfo.onDisplay[i] === true){
            cardDisplay.textContent = 'In museum';
            cardDisplay.classList.add('cardDisplay--on-display');
        } else if (artworksInfo.onDisplay[i] === false) {
            cardDisplay.textContent = 'Not on Display';
            cardDisplay.classList.add('cardDisplay--not-on-display');
        }

        cardBtn.innerText = 'Se værket på SMK';
        if (artworksInfo.webUrl[i]) {
            cardBtn.href = artworksInfo.webUrl[i];
            cardBtn.target = '_blank';
            cardBtn.rel = 'noopener noreferrer';
        } else {
            cardBtn.setAttribute('aria-disabled', 'true');
        }

        /* Apply styling */
        card.classList.add('card');
        cardTitle.classList.add('cardTitle');
        cardAuthor.classList.add('cardAuthor');
        cardYear.classList.add('cardYear');
        cardDisplay.classList.add('cardDisplay');
        cardBtn.classList.add('cardBtn')
        cardImage.classList.add('cardImage');

        /* Nest child elements to card */
        card.appendChild(cardTitle);
        card.appendChild(cardAuthor);
        card.appendChild(cardYear);
        card.appendChild(cardDisplay);
        card.appendChild(cardImage);
        card.appendChild(cardBtn);

        /* Show card on website */
        artworkList.append(card);
    }
}