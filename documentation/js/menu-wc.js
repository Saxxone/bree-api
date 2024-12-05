'use strict';

customElements.define('compodoc-menu', class extends HTMLElement {
    constructor() {
        super();
        this.isNormalMode = this.getAttribute('mode') === 'normal';
    }

    connectedCallback() {
        this.render(this.isNormalMode);
    }

    render(isNormalMode) {
        let tp = lithtml.html(`
        <nav>
            <ul class="list">
                <li class="title">
                    <a href="index.html" data-type="index-link">Bree API documentation</a>
                </li>

                <li class="divider"></li>
                ${ isNormalMode ? `<div id="book-search-input" role="search"><input type="text" placeholder="Type to search"></div>` : '' }
                <li class="chapter">
                    <a data-type="chapter-link" href="index.html"><span class="icon ion-ios-home"></span>Getting started</a>
                    <ul class="links">
                        <li class="link">
                            <a href="overview.html" data-type="chapter-link">
                                <span class="icon ion-ios-keypad"></span>Overview
                            </a>
                        </li>
                        <li class="link">
                            <a href="index.html" data-type="chapter-link">
                                <span class="icon ion-ios-paper"></span>README
                            </a>
                        </li>
                                <li class="link">
                                    <a href="dependencies.html" data-type="chapter-link">
                                        <span class="icon ion-ios-list"></span>Dependencies
                                    </a>
                                </li>
                                <li class="link">
                                    <a href="properties.html" data-type="chapter-link">
                                        <span class="icon ion-ios-apps"></span>Properties
                                    </a>
                                </li>
                    </ul>
                </li>
                    <li class="chapter modules">
                        <a data-type="chapter-link" href="modules.html">
                            <div class="menu-toggler linked" data-bs-toggle="collapse" ${ isNormalMode ?
                                'data-bs-target="#modules-links"' : 'data-bs-target="#xs-modules-links"' }>
                                <span class="icon ion-ios-archive"></span>
                                <span class="link-name">Modules</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                        </a>
                        <ul class="links collapse " ${ isNormalMode ? 'id="modules-links"' : 'id="xs-modules-links"' }>
                            <li class="link">
                                <a href="modules/AppModule.html" data-type="entity-link" >AppModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AppModule-6e17a271e66425925f7e967f5a3e984e1d3f2409a474dfb2facd656bbb1c320f81e0f81b517712395afbeab6e594ab51551968e07ac506081b8e31d7066291e2"' : 'data-bs-target="#xs-controllers-links-module-AppModule-6e17a271e66425925f7e967f5a3e984e1d3f2409a474dfb2facd656bbb1c320f81e0f81b517712395afbeab6e594ab51551968e07ac506081b8e31d7066291e2"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AppModule-6e17a271e66425925f7e967f5a3e984e1d3f2409a474dfb2facd656bbb1c320f81e0f81b517712395afbeab6e594ab51551968e07ac506081b8e31d7066291e2"' :
                                            'id="xs-controllers-links-module-AppModule-6e17a271e66425925f7e967f5a3e984e1d3f2409a474dfb2facd656bbb1c320f81e0f81b517712395afbeab6e594ab51551968e07ac506081b8e31d7066291e2"' }>
                                            <li class="link">
                                                <a href="controllers/AppController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AppController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AppModule-6e17a271e66425925f7e967f5a3e984e1d3f2409a474dfb2facd656bbb1c320f81e0f81b517712395afbeab6e594ab51551968e07ac506081b8e31d7066291e2"' : 'data-bs-target="#xs-injectables-links-module-AppModule-6e17a271e66425925f7e967f5a3e984e1d3f2409a474dfb2facd656bbb1c320f81e0f81b517712395afbeab6e594ab51551968e07ac506081b8e31d7066291e2"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AppModule-6e17a271e66425925f7e967f5a3e984e1d3f2409a474dfb2facd656bbb1c320f81e0f81b517712395afbeab6e594ab51551968e07ac506081b8e31d7066291e2"' :
                                        'id="xs-injectables-links-module-AppModule-6e17a271e66425925f7e967f5a3e984e1d3f2409a474dfb2facd656bbb1c320f81e0f81b517712395afbeab6e594ab51551968e07ac506081b8e31d7066291e2"' }>
                                        <li class="link">
                                            <a href="injectables/AppService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AppService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/AuthModule.html" data-type="entity-link" >AuthModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AuthModule-bda99cef8df3111c7c8b9a2ac402fab81f4cb414874ace21f3ed5246131c12c8cb8e8a5d3bebcd2240b070158b7170dedfaaf80bb30c98c23b02144669ff8854"' : 'data-bs-target="#xs-controllers-links-module-AuthModule-bda99cef8df3111c7c8b9a2ac402fab81f4cb414874ace21f3ed5246131c12c8cb8e8a5d3bebcd2240b070158b7170dedfaaf80bb30c98c23b02144669ff8854"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AuthModule-bda99cef8df3111c7c8b9a2ac402fab81f4cb414874ace21f3ed5246131c12c8cb8e8a5d3bebcd2240b070158b7170dedfaaf80bb30c98c23b02144669ff8854"' :
                                            'id="xs-controllers-links-module-AuthModule-bda99cef8df3111c7c8b9a2ac402fab81f4cb414874ace21f3ed5246131c12c8cb8e8a5d3bebcd2240b070158b7170dedfaaf80bb30c98c23b02144669ff8854"' }>
                                            <li class="link">
                                                <a href="controllers/AuthController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuthModule-bda99cef8df3111c7c8b9a2ac402fab81f4cb414874ace21f3ed5246131c12c8cb8e8a5d3bebcd2240b070158b7170dedfaaf80bb30c98c23b02144669ff8854"' : 'data-bs-target="#xs-injectables-links-module-AuthModule-bda99cef8df3111c7c8b9a2ac402fab81f4cb414874ace21f3ed5246131c12c8cb8e8a5d3bebcd2240b070158b7170dedfaaf80bb30c98c23b02144669ff8854"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuthModule-bda99cef8df3111c7c8b9a2ac402fab81f4cb414874ace21f3ed5246131c12c8cb8e8a5d3bebcd2240b070158b7170dedfaaf80bb30c98c23b02144669ff8854"' :
                                        'id="xs-injectables-links-module-AuthModule-bda99cef8df3111c7c8b9a2ac402fab81f4cb414874ace21f3ed5246131c12c8cb8e8a5d3bebcd2240b070158b7170dedfaaf80bb30c98c23b02144669ff8854"' }>
                                        <li class="link">
                                            <a href="injectables/AuthService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/PrismaService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PrismaService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/UserService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ChatModule.html" data-type="entity-link" >ChatModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-ChatModule-1961991e15193c5457e57d3560ef9f2d3a78352369379bb76604c949cec4e2eebec33bdf0bc40fa2b85396273f4e1bec28399ab8bb81a03884f9c569e51f2235"' : 'data-bs-target="#xs-controllers-links-module-ChatModule-1961991e15193c5457e57d3560ef9f2d3a78352369379bb76604c949cec4e2eebec33bdf0bc40fa2b85396273f4e1bec28399ab8bb81a03884f9c569e51f2235"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-ChatModule-1961991e15193c5457e57d3560ef9f2d3a78352369379bb76604c949cec4e2eebec33bdf0bc40fa2b85396273f4e1bec28399ab8bb81a03884f9c569e51f2235"' :
                                            'id="xs-controllers-links-module-ChatModule-1961991e15193c5457e57d3560ef9f2d3a78352369379bb76604c949cec4e2eebec33bdf0bc40fa2b85396273f4e1bec28399ab8bb81a03884f9c569e51f2235"' }>
                                            <li class="link">
                                                <a href="controllers/ChatController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ChatController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-ChatModule-1961991e15193c5457e57d3560ef9f2d3a78352369379bb76604c949cec4e2eebec33bdf0bc40fa2b85396273f4e1bec28399ab8bb81a03884f9c569e51f2235"' : 'data-bs-target="#xs-injectables-links-module-ChatModule-1961991e15193c5457e57d3560ef9f2d3a78352369379bb76604c949cec4e2eebec33bdf0bc40fa2b85396273f4e1bec28399ab8bb81a03884f9c569e51f2235"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ChatModule-1961991e15193c5457e57d3560ef9f2d3a78352369379bb76604c949cec4e2eebec33bdf0bc40fa2b85396273f4e1bec28399ab8bb81a03884f9c569e51f2235"' :
                                        'id="xs-injectables-links-module-ChatModule-1961991e15193c5457e57d3560ef9f2d3a78352369379bb76604c949cec4e2eebec33bdf0bc40fa2b85396273f4e1bec28399ab8bb81a03884f9c569e51f2235"' }>
                                        <li class="link">
                                            <a href="injectables/ChatService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ChatService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/PrismaService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PrismaService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/RoomService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RoomService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/UserService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/FileModule.html" data-type="entity-link" >FileModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-FileModule-25aaf383c685c69d3205c37f8e92f80a9f1a9ec1365c13519f1853f4abf0c5f0651ee7493201e3628ffc6e6b927bcf6e0ee12cd13cdeed87a9742a4005eccc81"' : 'data-bs-target="#xs-controllers-links-module-FileModule-25aaf383c685c69d3205c37f8e92f80a9f1a9ec1365c13519f1853f4abf0c5f0651ee7493201e3628ffc6e6b927bcf6e0ee12cd13cdeed87a9742a4005eccc81"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-FileModule-25aaf383c685c69d3205c37f8e92f80a9f1a9ec1365c13519f1853f4abf0c5f0651ee7493201e3628ffc6e6b927bcf6e0ee12cd13cdeed87a9742a4005eccc81"' :
                                            'id="xs-controllers-links-module-FileModule-25aaf383c685c69d3205c37f8e92f80a9f1a9ec1365c13519f1853f4abf0c5f0651ee7493201e3628ffc6e6b927bcf6e0ee12cd13cdeed87a9742a4005eccc81"' }>
                                            <li class="link">
                                                <a href="controllers/FileController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >FileController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-FileModule-25aaf383c685c69d3205c37f8e92f80a9f1a9ec1365c13519f1853f4abf0c5f0651ee7493201e3628ffc6e6b927bcf6e0ee12cd13cdeed87a9742a4005eccc81"' : 'data-bs-target="#xs-injectables-links-module-FileModule-25aaf383c685c69d3205c37f8e92f80a9f1a9ec1365c13519f1853f4abf0c5f0651ee7493201e3628ffc6e6b927bcf6e0ee12cd13cdeed87a9742a4005eccc81"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-FileModule-25aaf383c685c69d3205c37f8e92f80a9f1a9ec1365c13519f1853f4abf0c5f0651ee7493201e3628ffc6e6b927bcf6e0ee12cd13cdeed87a9742a4005eccc81"' :
                                        'id="xs-injectables-links-module-FileModule-25aaf383c685c69d3205c37f8e92f80a9f1a9ec1365c13519f1853f4abf0c5f0651ee7493201e3628ffc6e6b927bcf6e0ee12cd13cdeed87a9742a4005eccc81"' }>
                                        <li class="link">
                                            <a href="injectables/FileService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >FileService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/PrismaService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PrismaService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/UserService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/HealthModule.html" data-type="entity-link" >HealthModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-HealthModule-92d621ea60a6d22fc2fc839edd7ef966bc8ef969f1fd388b010b68a193bb85d412f18321852f5e467601a473a607c4d2f1ad7f59d60df6379a34ca1c4f45bca2"' : 'data-bs-target="#xs-controllers-links-module-HealthModule-92d621ea60a6d22fc2fc839edd7ef966bc8ef969f1fd388b010b68a193bb85d412f18321852f5e467601a473a607c4d2f1ad7f59d60df6379a34ca1c4f45bca2"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-HealthModule-92d621ea60a6d22fc2fc839edd7ef966bc8ef969f1fd388b010b68a193bb85d412f18321852f5e467601a473a607c4d2f1ad7f59d60df6379a34ca1c4f45bca2"' :
                                            'id="xs-controllers-links-module-HealthModule-92d621ea60a6d22fc2fc839edd7ef966bc8ef969f1fd388b010b68a193bb85d412f18321852f5e467601a473a607c4d2f1ad7f59d60df6379a34ca1c4f45bca2"' }>
                                            <li class="link">
                                                <a href="controllers/HealthController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >HealthController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-HealthModule-92d621ea60a6d22fc2fc839edd7ef966bc8ef969f1fd388b010b68a193bb85d412f18321852f5e467601a473a607c4d2f1ad7f59d60df6379a34ca1c4f45bca2"' : 'data-bs-target="#xs-injectables-links-module-HealthModule-92d621ea60a6d22fc2fc839edd7ef966bc8ef969f1fd388b010b68a193bb85d412f18321852f5e467601a473a607c4d2f1ad7f59d60df6379a34ca1c4f45bca2"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-HealthModule-92d621ea60a6d22fc2fc839edd7ef966bc8ef969f1fd388b010b68a193bb85d412f18321852f5e467601a473a607c4d2f1ad7f59d60df6379a34ca1c4f45bca2"' :
                                        'id="xs-injectables-links-module-HealthModule-92d621ea60a6d22fc2fc839edd7ef966bc8ef969f1fd388b010b68a193bb85d412f18321852f5e467601a473a607c4d2f1ad7f59d60df6379a34ca1c4f45bca2"' }>
                                        <li class="link">
                                            <a href="injectables/HealthService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >HealthService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/NotificationModule.html" data-type="entity-link" >NotificationModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-NotificationModule-5eb0221b94a64ff90f34a0d170d5ca0511edda96344135f346c61f004157b160713e8eb2d42a61155e5cd782a166571537e9e959c8bdc3b44a4b2fa1bf32a9c6"' : 'data-bs-target="#xs-controllers-links-module-NotificationModule-5eb0221b94a64ff90f34a0d170d5ca0511edda96344135f346c61f004157b160713e8eb2d42a61155e5cd782a166571537e9e959c8bdc3b44a4b2fa1bf32a9c6"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-NotificationModule-5eb0221b94a64ff90f34a0d170d5ca0511edda96344135f346c61f004157b160713e8eb2d42a61155e5cd782a166571537e9e959c8bdc3b44a4b2fa1bf32a9c6"' :
                                            'id="xs-controllers-links-module-NotificationModule-5eb0221b94a64ff90f34a0d170d5ca0511edda96344135f346c61f004157b160713e8eb2d42a61155e5cd782a166571537e9e959c8bdc3b44a4b2fa1bf32a9c6"' }>
                                            <li class="link">
                                                <a href="controllers/NotificationController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >NotificationController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-NotificationModule-5eb0221b94a64ff90f34a0d170d5ca0511edda96344135f346c61f004157b160713e8eb2d42a61155e5cd782a166571537e9e959c8bdc3b44a4b2fa1bf32a9c6"' : 'data-bs-target="#xs-injectables-links-module-NotificationModule-5eb0221b94a64ff90f34a0d170d5ca0511edda96344135f346c61f004157b160713e8eb2d42a61155e5cd782a166571537e9e959c8bdc3b44a4b2fa1bf32a9c6"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-NotificationModule-5eb0221b94a64ff90f34a0d170d5ca0511edda96344135f346c61f004157b160713e8eb2d42a61155e5cd782a166571537e9e959c8bdc3b44a4b2fa1bf32a9c6"' :
                                        'id="xs-injectables-links-module-NotificationModule-5eb0221b94a64ff90f34a0d170d5ca0511edda96344135f346c61f004157b160713e8eb2d42a61155e5cd782a166571537e9e959c8bdc3b44a4b2fa1bf32a9c6"' }>
                                        <li class="link">
                                            <a href="injectables/NotificationService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >NotificationService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/PostModule.html" data-type="entity-link" >PostModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-PostModule-283088ccd909d07bb18adc48dcf29a0ff98d753b4e8f93ae7d8a5fc309a1240c3127b7703f7c035289e8009bf62a07b976037ad01c2586313c0e9c7830b453f0"' : 'data-bs-target="#xs-controllers-links-module-PostModule-283088ccd909d07bb18adc48dcf29a0ff98d753b4e8f93ae7d8a5fc309a1240c3127b7703f7c035289e8009bf62a07b976037ad01c2586313c0e9c7830b453f0"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-PostModule-283088ccd909d07bb18adc48dcf29a0ff98d753b4e8f93ae7d8a5fc309a1240c3127b7703f7c035289e8009bf62a07b976037ad01c2586313c0e9c7830b453f0"' :
                                            'id="xs-controllers-links-module-PostModule-283088ccd909d07bb18adc48dcf29a0ff98d753b4e8f93ae7d8a5fc309a1240c3127b7703f7c035289e8009bf62a07b976037ad01c2586313c0e9c7830b453f0"' }>
                                            <li class="link">
                                                <a href="controllers/PostController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PostController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-PostModule-283088ccd909d07bb18adc48dcf29a0ff98d753b4e8f93ae7d8a5fc309a1240c3127b7703f7c035289e8009bf62a07b976037ad01c2586313c0e9c7830b453f0"' : 'data-bs-target="#xs-injectables-links-module-PostModule-283088ccd909d07bb18adc48dcf29a0ff98d753b4e8f93ae7d8a5fc309a1240c3127b7703f7c035289e8009bf62a07b976037ad01c2586313c0e9c7830b453f0"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-PostModule-283088ccd909d07bb18adc48dcf29a0ff98d753b4e8f93ae7d8a5fc309a1240c3127b7703f7c035289e8009bf62a07b976037ad01c2586313c0e9c7830b453f0"' :
                                        'id="xs-injectables-links-module-PostModule-283088ccd909d07bb18adc48dcf29a0ff98d753b4e8f93ae7d8a5fc309a1240c3127b7703f7c035289e8009bf62a07b976037ad01c2586313c0e9c7830b453f0"' }>
                                        <li class="link">
                                            <a href="injectables/FileService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >FileService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/PostService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PostService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/PrismaService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PrismaService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/UserService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/RoomModule.html" data-type="entity-link" >RoomModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-RoomModule-344943899c5fcb5928704fb180c90781a81e7d8dd1dd1ec5df402adea7472150d72083c732d36bc3adf2a1fe1833f1af54827d4e3d9aac252c4ec31a2cd4e605"' : 'data-bs-target="#xs-controllers-links-module-RoomModule-344943899c5fcb5928704fb180c90781a81e7d8dd1dd1ec5df402adea7472150d72083c732d36bc3adf2a1fe1833f1af54827d4e3d9aac252c4ec31a2cd4e605"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-RoomModule-344943899c5fcb5928704fb180c90781a81e7d8dd1dd1ec5df402adea7472150d72083c732d36bc3adf2a1fe1833f1af54827d4e3d9aac252c4ec31a2cd4e605"' :
                                            'id="xs-controllers-links-module-RoomModule-344943899c5fcb5928704fb180c90781a81e7d8dd1dd1ec5df402adea7472150d72083c732d36bc3adf2a1fe1833f1af54827d4e3d9aac252c4ec31a2cd4e605"' }>
                                            <li class="link">
                                                <a href="controllers/RoomController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RoomController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-RoomModule-344943899c5fcb5928704fb180c90781a81e7d8dd1dd1ec5df402adea7472150d72083c732d36bc3adf2a1fe1833f1af54827d4e3d9aac252c4ec31a2cd4e605"' : 'data-bs-target="#xs-injectables-links-module-RoomModule-344943899c5fcb5928704fb180c90781a81e7d8dd1dd1ec5df402adea7472150d72083c732d36bc3adf2a1fe1833f1af54827d4e3d9aac252c4ec31a2cd4e605"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-RoomModule-344943899c5fcb5928704fb180c90781a81e7d8dd1dd1ec5df402adea7472150d72083c732d36bc3adf2a1fe1833f1af54827d4e3d9aac252c4ec31a2cd4e605"' :
                                        'id="xs-injectables-links-module-RoomModule-344943899c5fcb5928704fb180c90781a81e7d8dd1dd1ec5df402adea7472150d72083c732d36bc3adf2a1fe1833f1af54827d4e3d9aac252c4ec31a2cd4e605"' }>
                                        <li class="link">
                                            <a href="injectables/PrismaService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PrismaService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/RoomService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >RoomService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/UserService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/UserModule.html" data-type="entity-link" >UserModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-UserModule-895868fd5753890d8d767392e418d52e520d62f9854e7489f24df5b19ab5055116a8cf627e3807d39fc7bb2e06596b6f96256f1011a65a110ea5903576a9c763"' : 'data-bs-target="#xs-controllers-links-module-UserModule-895868fd5753890d8d767392e418d52e520d62f9854e7489f24df5b19ab5055116a8cf627e3807d39fc7bb2e06596b6f96256f1011a65a110ea5903576a9c763"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-UserModule-895868fd5753890d8d767392e418d52e520d62f9854e7489f24df5b19ab5055116a8cf627e3807d39fc7bb2e06596b6f96256f1011a65a110ea5903576a9c763"' :
                                            'id="xs-controllers-links-module-UserModule-895868fd5753890d8d767392e418d52e520d62f9854e7489f24df5b19ab5055116a8cf627e3807d39fc7bb2e06596b6f96256f1011a65a110ea5903576a9c763"' }>
                                            <li class="link">
                                                <a href="controllers/UserController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-UserModule-895868fd5753890d8d767392e418d52e520d62f9854e7489f24df5b19ab5055116a8cf627e3807d39fc7bb2e06596b6f96256f1011a65a110ea5903576a9c763"' : 'data-bs-target="#xs-injectables-links-module-UserModule-895868fd5753890d8d767392e418d52e520d62f9854e7489f24df5b19ab5055116a8cf627e3807d39fc7bb2e06596b6f96256f1011a65a110ea5903576a9c763"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-UserModule-895868fd5753890d8d767392e418d52e520d62f9854e7489f24df5b19ab5055116a8cf627e3807d39fc7bb2e06596b6f96256f1011a65a110ea5903576a9c763"' :
                                        'id="xs-injectables-links-module-UserModule-895868fd5753890d8d767392e418d52e520d62f9854e7489f24df5b19ab5055116a8cf627e3807d39fc7bb2e06596b6f96256f1011a65a110ea5903576a9c763"' }>
                                        <li class="link">
                                            <a href="injectables/PrismaService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >PrismaService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/UserService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UserService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                </ul>
                </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#classes-links"' :
                            'data-bs-target="#xs-classes-links"' }>
                            <span class="icon ion-ios-paper"></span>
                            <span>Classes</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="classes-links"' : 'id="xs-classes-links"' }>
                            <li class="link">
                                <a href="classes/Chat.html" data-type="entity-link" >Chat</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChatCreatedEvent.html" data-type="entity-link" >ChatCreatedEvent</a>
                            </li>
                            <li class="link">
                                <a href="classes/ChatGateway.html" data-type="entity-link" >ChatGateway</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateChatDto.html" data-type="entity-link" >CreateChatDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateFedUserDto.html" data-type="entity-link" >CreateFedUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateFileDto.html" data-type="entity-link" >CreateFileDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateHealthDto.html" data-type="entity-link" >CreateHealthDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateNotificationDto.html" data-type="entity-link" >CreateNotificationDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreatePostDto.html" data-type="entity-link" >CreatePostDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateRoomDto.html" data-type="entity-link" >CreateRoomDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateUserDto.html" data-type="entity-link" >CreateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ExceptionsLoggerFilter.html" data-type="entity-link" >ExceptionsLoggerFilter</a>
                            </li>
                            <li class="link">
                                <a href="classes/File.html" data-type="entity-link" >File</a>
                            </li>
                            <li class="link">
                                <a href="classes/GoogleAuthUser.html" data-type="entity-link" >GoogleAuthUser</a>
                            </li>
                            <li class="link">
                                <a href="classes/Health.html" data-type="entity-link" >Health</a>
                            </li>
                            <li class="link">
                                <a href="classes/JoinRoomDto.html" data-type="entity-link" >JoinRoomDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/Notification.html" data-type="entity-link" >Notification</a>
                            </li>
                            <li class="link">
                                <a href="classes/Room.html" data-type="entity-link" >Room</a>
                            </li>
                            <li class="link">
                                <a href="classes/RoomGateway.html" data-type="entity-link" >RoomGateway</a>
                            </li>
                            <li class="link">
                                <a href="classes/SignInDto.html" data-type="entity-link" >SignInDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateChatDto.html" data-type="entity-link" >UpdateChatDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateFileDto.html" data-type="entity-link" >UpdateFileDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateHealthDto.html" data-type="entity-link" >UpdateHealthDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateNotificationDto.html" data-type="entity-link" >UpdateNotificationDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdatePostDto.html" data-type="entity-link" >UpdatePostDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateRoomDto.html" data-type="entity-link" >UpdateRoomDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateUserDto.html" data-type="entity-link" >UpdateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UserRoomKey.html" data-type="entity-link" >UserRoomKey</a>
                            </li>
                        </ul>
                    </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#injectables-links"' :
                                'data-bs-target="#xs-injectables-links"' }>
                                <span class="icon ion-md-arrow-round-down"></span>
                                <span>Injectables</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="injectables-links"' : 'id="xs-injectables-links"' }>
                                <li class="link">
                                    <a href="injectables/ChatCreatedListener.html" data-type="entity-link" >ChatCreatedListener</a>
                                </li>
                                <li class="link">
                                    <a href="injectables/LoggingInterceptor.html" data-type="entity-link" >LoggingInterceptor</a>
                                </li>
                            </ul>
                        </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#guards-links"' :
                            'data-bs-target="#xs-guards-links"' }>
                            <span class="icon ion-ios-lock"></span>
                            <span>Guards</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="guards-links"' : 'id="xs-guards-links"' }>
                            <li class="link">
                                <a href="guards/AuthGuard.html" data-type="entity-link" >AuthGuard</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#interfaces-links"' :
                            'data-bs-target="#xs-interfaces-links"' }>
                            <span class="icon ion-md-information-circle-outline"></span>
                            <span>Interfaces</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? ' id="interfaces-links"' : 'id="xs-interfaces-links"' }>
                            <li class="link">
                                <a href="interfaces/AuthUser.html" data-type="entity-link" >AuthUser</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/JwtSubPayload.html" data-type="entity-link" >JwtSubPayload</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#miscellaneous-links"'
                            : 'data-bs-target="#xs-miscellaneous-links"' }>
                            <span class="icon ion-ios-cube"></span>
                            <span>Miscellaneous</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="miscellaneous-links"' : 'id="xs-miscellaneous-links"' }>
                            <li class="link">
                                <a href="miscellaneous/functions.html" data-type="entity-link">Functions</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/variables.html" data-type="entity-link">Variables</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <a data-type="chapter-link" href="coverage.html"><span class="icon ion-ios-stats"></span>Documentation coverage</a>
                    </li>
                    <li class="divider"></li>
                    <li class="copyright">
                        Documentation generated using <a href="https://compodoc.app/" target="_blank" rel="noopener noreferrer">
                            <img data-src="images/compodoc-vectorise.png" class="img-responsive" data-type="compodoc-logo">
                        </a>
                    </li>
            </ul>
        </nav>
        `);
        this.innerHTML = tp.strings;
    }
});